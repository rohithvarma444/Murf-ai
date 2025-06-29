const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const DubbingService = require('../services/dubbingService');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const dubbingService = new DubbingService();

// Configure multer for video/audio uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/dubbing';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 100 * 1024 * 1024 // 100MB limit for video files
  },
  fileFilter: (req, file, cb) => {
    // Allow video and audio files
    const allowedMimeTypes = [
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv',
      'audio/mp3', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/m4a'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video and audio files are allowed.'), false);
    }
  }
});

// Validation schemas
const createDubbingJobSchema = z.object({
  fileName: z.string().min(1).max(255),
  targetLocales: z.array(z.string()).min(1).max(26),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('LOW'),
  webhookUrl: z.string().url().optional(),
  webhookSecret: z.string().optional(),
  projectName: z.string().optional(),
  persistent: z.boolean().default(false)
});

const urlDubbingJobSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileUrl: z.string().url(),
  targetLocales: z.array(z.string()).min(1).max(26),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('LOW'),
  webhookUrl: z.string().url().optional(),
  webhookSecret: z.string().optional(),
  projectName: z.string().optional(),
  persistent: z.boolean().default(false)
});

/**
 * Get supported languages
 * GET /api/dubbing/languages
 */
router.get('/languages', async (req, res) => {
  try {
    const sourceLanguages = dubbingService.getSupportedSourceLanguages();
    const destinationLanguages = dubbingService.getSupportedDestinationLanguages();
    
    res.json({
      success: true,
      data: {
        sourceLanguages: sourceLanguages.map(code => ({
          code,
          name: dubbingService.getLanguageName(code)
        })),
        destinationLanguages: destinationLanguages.map(code => ({
          code,
          name: dubbingService.getLanguageName(code)
        }))
      }
    });
  } catch (error) {
    console.error('Get languages error:', error);
    res.status(500).json({ 
      error: 'Failed to get supported languages',
      details: error.message 
    });
  }
});

/**
 * Create dubbing job with file upload
 * POST /api/dubbing/create
 */
router.post('/create', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const validationData = createDubbingJobSchema.parse({
      fileName: req.body.fileName || req.file.originalname,
      targetLocales: JSON.parse(req.body.targetLocales || '["en_US"]'),
      priority: req.body.priority || 'LOW',
      webhookUrl: req.body.webhookUrl,
      webhookSecret: req.body.webhookSecret,
      projectName: req.body.projectName,
      persistent: req.body.persistent === 'true'
    });

    console.log(`🎬 Creating dubbing job for uploaded file: ${req.file.originalname}`);
    console.log(`📄 File size: ${req.file.size} bytes`);
    console.log(`🌐 Target locales: ${validationData.targetLocales.join(', ')}`);
    console.log(`📁 Persistent: ${validationData.persistent}`);

    // Validate target languages
    const languageValidation = dubbingService.validateLanguages(validationData.targetLocales);
    if (!languageValidation.isValid) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'Invalid target languages',
        unsupportedLanguages: languageValidation.unsupportedLanguages
      });
    }

    const dubbingOptions = {
      fileName: validationData.fileName,
      file: req.file.path,
      targetLocales: validationData.targetLocales,
      priority: validationData.priority,
      webhookUrl: validationData.webhookUrl,
      webhookSecret: validationData.webhookSecret,
      projectName: validationData.projectName
    };

    let result;
    if (validationData.persistent) {
      result = await dubbingService.createPersistentDubbingJob(dubbingOptions);
    } else {
      result = await dubbingService.createDubbingJob(dubbingOptions);
    }

    // Clean up uploaded file after processing
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Create dubbing job error:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create dubbing job',
      details: error.message 
    });
  }
});

/**
 * Create dubbing job with file URL
 * POST /api/dubbing/create-url
 */
router.post('/create-url', async (req, res) => {
  try {
    const validationData = urlDubbingJobSchema.parse(req.body);

    console.log(`🎬 Creating dubbing job for URL: ${validationData.fileUrl}`);
    console.log(`🌐 Target locales: ${validationData.targetLocales.join(', ')}`);
    console.log(`📁 Persistent: ${validationData.persistent}`);

    // Validate target languages
    const languageValidation = dubbingService.validateLanguages(validationData.targetLocales);
    if (!languageValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid target languages',
        unsupportedLanguages: languageValidation.unsupportedLanguages
      });
    }

    const dubbingOptions = {
      fileName: validationData.fileName,
      fileUrl: validationData.fileUrl,
      targetLocales: validationData.targetLocales,
      priority: validationData.priority,
      webhookUrl: validationData.webhookUrl,
      webhookSecret: validationData.webhookSecret,
      projectName: validationData.projectName
    };

    let result;
    if (validationData.persistent) {
      result = await dubbingService.createPersistentDubbingJob(dubbingOptions);
    } else {
      result = await dubbingService.createDubbingJob(dubbingOptions);
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Create dubbing job from URL error:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create dubbing job',
      details: error.message 
    });
  }
});

/**
 * Get dubbing job status
 * GET /api/dubbing/status/:jobId
 */
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    console.log(`🔍 Getting status for dubbing job: ${jobId}`);

    const result = await dubbingService.getDubbingJobStatus(jobId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error(`Get dubbing job status error for ${req.params.jobId}:`, error);
    res.status(500).json({ 
      error: 'Failed to get dubbing job status',
      details: error.message 
    });
  }
});

/**
 * Download dubbed content
 * POST /api/dubbing/download
 */
router.post('/download', async (req, res) => {
  try {
    const { downloadUrl, fileName } = req.body;
    
    if (!downloadUrl) {
      return res.status(400).json({ error: 'Download URL is required' });
    }

    console.log(`⬇️ Starting download for: ${fileName || 'dubbed_content'}`);

    // Create downloads directory if it doesn't exist
    const downloadsDir = path.join(process.cwd(), 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const outputFileName = fileName || `dubbed_content_${Date.now()}.mp4`;
    const outputPath = path.join(downloadsDir, outputFileName);

    const filePath = await dubbingService.downloadDubbedContent(downloadUrl, outputPath);

    // Get file stats for response
    const stats = fs.statSync(filePath);

    res.json({
      success: true,
      data: {
        filePath: filePath,
        fileName: outputFileName,
        fileSize: stats.size,
        downloadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Download dubbed content error:', error);
    res.status(500).json({ 
      error: 'Failed to download dubbed content',
      details: error.message 
    });
  }
});

/**
 * Estimate dubbing cost
 * POST /api/dubbing/estimate-cost
 */
router.post('/estimate-cost', async (req, res) => {
  try {
    const { durationMinutes, targetLocales } = req.body;
    
    if (!durationMinutes || !targetLocales) {
      return res.status(400).json({ 
        error: 'Duration in minutes and target locales are required' 
      });
    }

    if (!Array.isArray(targetLocales)) {
      return res.status(400).json({ 
        error: 'Target locales must be an array' 
      });
    }

    // Validate target languages
    const languageValidation = dubbingService.validateLanguages(targetLocales);
    if (!languageValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid target languages',
        unsupportedLanguages: languageValidation.unsupportedLanguages
      });
    }

    const costEstimation = dubbingService.estimateCost(durationMinutes, targetLocales.length);

    res.json({
      success: true,
      data: {
        ...costEstimation,
        targetLocales: targetLocales.map(code => ({
          code,
          name: dubbingService.getLanguageName(code)
        }))
      }
    });

  } catch (error) {
    console.error('Estimate cost error:', error);
    res.status(500).json({ 
      error: 'Failed to estimate dubbing cost',
      details: error.message 
    });
  }
});

/**
 * Validate language codes
 * POST /api/dubbing/validate-languages
 */
router.post('/validate-languages', async (req, res) => {
  try {
    const { targetLocales } = req.body;
    
    if (!targetLocales || !Array.isArray(targetLocales)) {
      return res.status(400).json({ 
        error: 'Target locales array is required' 
      });
    }

    const validation = dubbingService.validateLanguages(targetLocales);

    res.json({
      success: true,
      data: {
        ...validation,
        supportedLanguages: validation.supportedLanguages.map(code => ({
          code,
          name: dubbingService.getLanguageName(code)
        })),
        unsupportedLanguages: validation.unsupportedLanguages.map(code => ({
          code,
          name: dubbingService.getLanguageName(code)
        }))
      }
    });

  } catch (error) {
    console.error('Validate languages error:', error);
    res.status(500).json({ 
      error: 'Failed to validate languages',
      details: error.message 
    });
  }
});

/**
 * Health check for dubbing service
 * GET /api/dubbing/health
 */
router.get('/health', async (req, res) => {
  try {
    const isHealthy = !!process.env.MURF_API_KEY;
    
    res.json({
      success: true,
      data: {
        status: isHealthy ? 'healthy' : 'unhealthy',
        apiKeyConfigured: !!process.env.MURF_API_KEY,
        supportedSourceLanguages: dubbingService.getSupportedSourceLanguages().length,
        supportedDestinationLanguages: dubbingService.getSupportedDestinationLanguages().length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Dubbing health check error:', error);
    res.status(500).json({ 
      error: 'Health check failed',
      details: error.message 
    });
  }
});

module.exports = router; 