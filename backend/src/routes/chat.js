const express = require('express');
const { z } = require('zod');
const AIService = require('../services/aiService');
const TranslationService = require('../services/translationService');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const aiService = new AIService();
const translationService = new TranslationService();
const prisma = new PrismaClient();

// Validation schemas
const chatMessageSchema = z.object({
  message: z.string().min(1).max(1000),
  language: z.string().default('en'),
});

const batchTranslationSchema = z.object({
  sentences: z.array(z.string().max(4000)).max(10),
  target_language: z.enum(['en-US', 'hi-IN', 'bn-IN', 'ta-IN'])
});

/**
 * Batch translation endpoint
 * POST /api/chat/translate
 */
router.post('/translate', async (req, res) => {
  try {
    const { sentences, target_language } = batchTranslationSchema.parse(req.body);

    // Validate input
    if (sentences.length === 0) {
      return res.status(400).json({ error: 'At least one sentence is required' });
    }

    if (sentences.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 sentences allowed' });
    }

    // Check character limits
    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i].length > 4000) {
        return res.status(400).json({ 
          error: `Sentence ${i + 1} exceeds 4000 character limit` 
        });
      }
    }

    // Convert target language code to internal format
    const targetLangMap = {
      'en-US': 'en',
      'hi-IN': 'hi',
      'bn-IN': 'bn',
      'ta-IN': 'ta'
    };

    const internalTargetLang = targetLangMap[target_language];
    if (!internalTargetLang) {
      return res.status(400).json({ error: 'Unsupported target language' });
    }

    // Translate sentences
    const translations = await translationService.translateMultipleTexts(
      sentences, 
      internalTargetLang, 
      'en' // Always translate from English
    );

    res.json({
      translations: translations
    });

  } catch (error) {
    console.error('Batch translation error:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    
    res.status(500).json({ 
      error: 'Translation failed', 
      details: error.message 
    });
  }
});

/**
 * Get public project information
 * GET /api/chat/:projectId/public
 */
router.get('/:projectId/public', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Get project by public URL or ID
    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { id: projectId },
          { publicUrl: projectId }
        ],
        isActive: true
      },
      include: {
        documents: true
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or inactive' });
    }

    res.json({
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          publicUrl: project.publicUrl
        }
      }
    });

  } catch (error) {
    console.error('Get public project error:', error);
    res.status(500).json({ 
      error: 'Failed to get project information',
      details: error.message 
    });
  }
});

/**
 * Send text message
 * POST /api/chat/:projectId
 */
router.post('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { message, language = 'en' } = chatMessageSchema.parse(req.body);

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Validate project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { documents: true }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Process chat message with translation
    const result = await aiService.processChatMessage(projectId, message, language);

    res.json({
      success: true,
      data: {
        response: result.response,
        language: result.language,
        context: result.context,
        originalMessage: result.originalMessage,
        englishMessage: result.englishMessage
      }
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      details: error.message 
    });
  }
});

/**
 * Get supported languages
 * GET /api/chat/languages
 */
router.get('/languages', async (req, res) => {
  try {
    const languages = aiService.getSupportedLanguages();
    res.json({
      success: true,
      data: { languages }
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
 * Get chat statistics (simplified - no database storage)
 * GET /api/chat/:projectId/stats
 */
router.get('/:projectId/stats', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Validate project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Return basic stats (no database storage for chat history)
    res.json({
      success: true,
      data: {
        totalSessions: 0,
        totalMessages: 0,
        languageStats: [],
        message: "Chat history is stored locally in the browser"
      }
    });
  } catch (error) {
    console.error('Get chat stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get chat statistics',
      details: error.message 
    });
  }
});

module.exports = router; 