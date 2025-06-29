const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { PrismaClient } = require('@prisma/client');
const PDFProcessor = require('../services/pdfProcessor');
const { z } = require('zod');

const router = express.Router();
const prisma = new PrismaClient();
const pdfProcessor = new PDFProcessor();

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, company: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

// Get all projects for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.id },
      include: {
        documents: {
          select: {
            id: true,
            filename: true,
            fileSize: true,
            createdAt: true,
          }
        },
        _count: {
          select: {
            chatSessions: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ projects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific project
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      include: {
        documents: {
          select: {
            id: true,
            filename: true,
            fileSize: true,
            createdAt: true,
          }
        },
        chatSessions: {
          select: {
            id: true,
            language: true,
            startedAt: true,
            _count: {
              select: {
                messages: true,
              }
            }
          },
          orderBy: { startedAt: 'desc' },
          take: 10
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new project with PDF upload (Atomic operation)
router.post('/', authenticateToken, upload.single('pdf'), async (req, res) => {
  try {
    const { name, description } = createProjectSchema.parse(req.body);

    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    // Read the uploaded PDF file
    const pdfBuffer = await fs.readFile(req.file.path);

    // Prepare project data
    const projectData = {
      name,
      description: description || '',
      filename: req.file.originalname,
    };

    console.log(`🚀 Starting PDF processing for project: ${name}`);

    // Process PDF atomically - this will only create the project if everything succeeds
    const result = await pdfProcessor.processPDFAtomically(pdfBuffer, projectData, req.user.id);

    // Clean up uploaded file
    try {
      await fs.unlink(req.file.path);
    } catch (cleanupError) {
      console.error('Failed to cleanup uploaded file:', cleanupError);
    }

    console.log(`✅ Project created successfully: ${result.project.id}`);

    res.status(201).json({
      message: 'Project created successfully',
      project: {
        id: result.project.id,
        name: result.project.name,
        description: result.project.description,
        createdAt: result.project.createdAt,
      },
      document: {
        id: result.document.id,
        filename: result.document.filename,
        fileSize: result.document.fileSize,
      },
      stats: result.stats,
    });
  } catch (error) {
    console.error('Create project error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded file:', cleanupError);
      }
    }
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a project
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description } = createProjectSchema.parse(req.body);

    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updatedProject = await prisma.project.update({
      where: { id: req.params.id },
      data: { name, description },
      include: {
        documents: {
          select: {
            id: true,
            filename: true,
            fileSize: true,
            createdAt: true,
          }
        }
      }
    });

    res.json({ project: updatedProject });
  } catch (error) {
    console.error('Update project error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a project
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await prisma.project.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get project statistics
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [totalSessions, totalMessages, languageStats] = await Promise.all([
      prisma.chatSession.count({
        where: { projectId: req.params.id }
      }),
      prisma.chatMessage.count({
        where: {
          session: { projectId: req.params.id }
        }
      }),
      prisma.chatSession.groupBy({
        by: ['language'],
        where: { projectId: req.params.id },
        _count: {
          id: true
        }
      })
    ]);

    res.json({
      totalSessions,
      totalMessages,
      languageStats: languageStats.map(stat => ({
        language: stat.language,
        count: stat._count.id
      }))
    });
  } catch (error) {
    console.error('Get project stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 