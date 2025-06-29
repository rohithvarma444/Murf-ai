require('dotenv').config();

// Debug environment variables
console.log('🔧 Environment check:');
console.log('🔑 GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? 'Set' : 'Not set');
console.log('🌐 MURF_API_KEY:', process.env.MURF_API_KEY ? 'Set' : 'Not set');
console.log('🗄️ DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
console.log('🔐 JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const aiService = require('./services/aiService');
const TranslationService = require('./services/translationService');
const speechToTextService = require('./services/speechToTextService');
const PDFProcessor = require('./services/pdfProcessor');
const TTSService = require('./services/ttsService');
const EmotionService = require('./services/emotionService');
const CustomerCareService = require('./services/customerCareService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:5176"],
    credentials: true
  }
});
// Use the same translation service instance as AI service
const translationService = new TranslationService();
const pdfProcessor = new PDFProcessor();
const ttsService = new TTSService();
const emotionService = new EmotionService();
const customerCareService = new CustomerCareService(io);
const PORT = process.env.PORT || 3001;

// Import routes
const projectRoutes = require('./routes/projects');
const authRoutes = require('./routes/auth');
const dubbingRoutes = require('./routes/dubbing');

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Simple audio transcription endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Get language from request body, default to 'en'
    const language = req.body.language || 'en';
    
    console.log('🎵 Received audio file:', req.file.originalname, 'Size:', req.file.size, 'Language:', language);

    // Read the audio file
    const audioBuffer = require('fs').readFileSync(req.file.path);
    
    // Map internal language code to Google Speech language code
    const speechLanguageCode = speechToTextService.mapLanguageCode(language);
    
    // Transcribe the audio with the specified language
    const transcription = await speechToTextService.transcribeAudio(audioBuffer, speechLanguageCode);
    
    console.log('📝 Transcription result:', transcription);
    
    // Clean up the uploaded file
    require('fs').unlinkSync(req.file.path);
    
    res.json({ 
      success: true, 
      transcription: transcription,
      language: language,
      speechLanguageCode: speechLanguageCode,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Transcription error:', error);
    res.status(500).json({ 
      error: 'Failed to transcribe audio',
      details: error.message 
    });
  }
});

// Complete voice-to-chat endpoint with translation flow
app.post('/api/voice-chat', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Get language from request body, default to 'en'
    const targetLanguage = req.body.language || 'en';
    
    console.log('🎵 === VOICE CHAT FLOW STARTED ===');
    console.log('🎵 Received audio file:', req.file.originalname, 'Size:', req.file.size, 'Target Language:', targetLanguage);

    // Step 1: Read the audio file
    const audioBuffer = require('fs').readFileSync(req.file.path);
    
    // Step 2: Map internal language code to Google Speech language code
    const speechLanguageCode = speechToTextService.mapLanguageCode(targetLanguage);
    console.log('🌐 Speech recognition language code:', speechLanguageCode);
    
    // Step 3: Transcribe the audio with the specified language
    const transcription = await speechToTextService.transcribeAudio(audioBuffer, speechLanguageCode);
    console.log('📝 STEP 1 - Transcription result:', transcription);
    
    // Step 4: Detect the language of the transcription
    const detectedLanguage = await translationService.detectLanguage(transcription);
    console.log('🔍 STEP 2 - Detected language of transcription:', detectedLanguage);
    
    let englishMessage = transcription;
    let originalMessage = transcription;
    
    // Step 5: Translate to English if not already English
    if (detectedLanguage !== 'en') {
      console.log('🌐 STEP 3 - Translating from', detectedLanguage, 'to English');
      try {
        englishMessage = await translationService.translateText(transcription, 'en');
        console.log('✅ STEP 4 - Translated to English:', englishMessage);
      } catch (translationError) {
        console.error('❌ Translation error:', translationError);
        // If translation fails, use original transcription
        englishMessage = transcription;
      }
    } else {
      console.log('✅ STEP 4 - Already in English, no translation needed');
    }
    
    // Step 6: Get AI response using English text
    console.log('🤖 STEP 5 - Getting AI response for:', englishMessage);
    const aiResponse = await aiService.generateResponse(englishMessage, [], 'en');
    console.log('✅ STEP 6 - AI Response in English:', aiResponse.response);
    
    // Step 7: Translate AI response back to target language if needed
    let finalResponse = aiResponse.response;
    if (targetLanguage !== 'en') {
      console.log('🌐 STEP 7 - Translating AI response to', targetLanguage);
      try {
        finalResponse = await translationService.translateText(aiResponse.response, targetLanguage);
        console.log('✅ STEP 8 - Final response in', targetLanguage + ':', finalResponse);
      } catch (translationError) {
        console.error('❌ Response translation error:', translationError);
        // If translation fails, return English response
        finalResponse = aiResponse.response;
      }
    } else {
      console.log('✅ STEP 8 - Response already in English');
    }
    
    // Clean up the uploaded file
    require('fs').unlinkSync(req.file.path);
    
    console.log('🎵 === VOICE CHAT FLOW COMPLETED ===');
    
    res.json({ 
      success: true, 
      transcription: transcription,
      detectedLanguage: detectedLanguage,
      englishMessage: englishMessage,
      aiResponse: aiResponse.response,
      finalResponse: finalResponse,
      targetLanguage: targetLanguage,
      speechLanguageCode: speechLanguageCode,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Voice chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process voice chat',
      details: error.message 
    });
  }
});

// Chat endpoint - with project context using embeddings
app.post('/api/chat', async (req, res) => {
  try {
    const { message, projectId, language = 'en' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`💬 Chat request - Project: ${projectId}, Language: ${language}, Message: ${message}`);

    let response;
    
    if (projectId) {
      // Use project-specific chat with embeddings
      response = await aiService.processChatMessage(projectId, message, language);
      console.log(`🤖 AI Response with context: ${response.response}`);
    } else {
      // Use general chat without project documents
      response = await aiService.generateResponse(message, [], language);
      console.log(`🤖 AI Response (general): ${response.response}`);
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat request',
      details: error.message 
    });
  }
});

// Translation endpoint
app.post('/api/translate', async (req, res) => {
  try {
    const { sentences, targetLanguage } = req.body;

    if (!sentences || !Array.isArray(sentences) || !targetLanguage) {
      return res.status(400).json({ 
        error: 'sentences (array) and targetLanguage are required' 
      });
    }

    console.log(`🌐 Translation request - Target: ${targetLanguage}, Sentences: ${sentences.length}`);

    const translations = await translationService.translateSentences(sentences, targetLanguage);

    console.log(`✅ Translation result:`, translations);

    res.json({ 
      success: true, 
      translations,
      targetLanguage 
    });

  } catch (error) {
    console.error('❌ Translation error:', error);
    res.status(500).json({ 
      error: 'Failed to translate text',
      details: error.message 
    });
  }
});

// Test translation endpoint for debugging
app.post('/api/test-translate', async (req, res) => {
  try {
    const { text, sourceLanguage, targetLanguage } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({ 
        error: 'text and targetLanguage are required' 
      });
    }

    console.log(`🧪 Test translation - From: ${sourceLanguage || 'auto'}, To: ${targetLanguage}, Text: "${text}"`);

    // Test language detection
    const detectedLanguage = await translationService.detectLanguage(text);
    console.log(`🔍 Detected language: ${detectedLanguage}`);

    // Test translation
    const translatedText = await translationService.translateText(text, targetLanguage);
    console.log(`✅ Translated text: "${translatedText}"`);

    res.json({ 
      success: true, 
      originalText: text,
      detectedLanguage: detectedLanguage,
      translatedText: translatedText,
      sourceLanguage: sourceLanguage || detectedLanguage,
      targetLanguage: targetLanguage
    });

  } catch (error) {
    console.error('❌ Test translation error:', error);
    res.status(500).json({ 
      error: 'Failed to test translation',
      details: error.message 
    });
  }
});

// Text-to-Speech endpoint
app.post('/api/tts/generate', async (req, res) => {
  try {
    const { text, language = 'en', options = {} } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ 
        error: 'text is required' 
      });
    }

    console.log(`🔊 TTS request - Language: ${language}, Text length: ${text.length}`);

    // Generate speech using TTS service
    const ttsResult = await ttsService.generateSpeech(text, language, options);
    
    console.log(`✅ TTS generated successfully: ${ttsResult.audioUrl}`);

    res.json({ 
      success: true, 
      audioUrl: ttsResult.audioUrl,
      voiceId: ttsResult.voiceId,
      language: ttsResult.language,
      textLength: ttsResult.textLength,
      format: ttsResult.format,
      timestamp: ttsResult.timestamp
    });

  } catch (error) {
    console.error('❌ TTS generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate speech',
      details: error.message 
    });
  }
});

// Emotion detection endpoint
app.post('/api/emotion/detect', async (req, res) => {
  try {
    const { text, language = 'en' } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ 
        error: 'text is required' 
      });
    }

    console.log(`😊 Emotion detection request - Language: ${language}, Text length: ${text.length}`);

    // Detect emotions in text
    const emotionResult = await emotionService.detectEmotion(text, language);
    
    console.log(`✅ Emotion detected: ${emotionResult.primaryEmotion} (confidence: ${emotionResult.confidence})`);

    res.json({ 
      success: true, 
      primaryEmotion: emotionResult.primaryEmotion,
      confidence: emotionResult.confidence,
      emotions: emotionResult.emotions,
      wordMapping: emotionResult.wordMapping,
      emotionColor: emotionService.getEmotionColor(emotionResult.primaryEmotion),
      emotionIcon: emotionService.getEmotionIcon(emotionResult.primaryEmotion),
      emotionDescription: emotionService.getEmotionDescription(emotionResult.primaryEmotion)
    });

  } catch (error) {
    console.error('❌ Emotion detection error:', error);
    res.status(500).json({ 
      error: 'Failed to detect emotions',
      details: error.message 
    });
  }
});

// Enhanced chat endpoint with TTS and emotion detection
app.post('/api/chat/enhanced', async (req, res) => {
  try {
    const { message, projectId, language = 'en', generateAudio = false } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`💬 Enhanced chat request - Project: ${projectId}, Language: ${language}, Generate Audio: ${generateAudio}`);

    let response;
    
    if (projectId) {
      // Use project-specific chat with embeddings
      response = await aiService.processChatMessage(projectId, message, language);
      console.log(`🤖 AI Response with context: ${response.response}`);
    } else {
      // Use general chat without project documents
      response = await aiService.generateResponse(message, [], language);
      console.log(`🤖 AI Response (general): ${response.response}`);
    }

    // Detect emotions in the AI response
    const emotionResult = await emotionService.detectEmotion(response.response, language);
    console.log(`😊 Response emotion: ${emotionResult.primaryEmotion}`);

    const result = {
      ...response,
      emotion: {
        primaryEmotion: emotionResult.primaryEmotion,
        confidence: emotionResult.confidence,
        emotions: emotionResult.emotions,
        wordMapping: emotionResult.wordMapping,
        emotionColor: emotionService.getEmotionColor(emotionResult.primaryEmotion),
        emotionIcon: emotionService.getEmotionIcon(emotionResult.primaryEmotion),
        emotionDescription: emotionService.getEmotionDescription(emotionResult.primaryEmotion)
      }
    };

    // Generate audio if requested
    if (generateAudio) {
      try {
        console.log(`🔊 Generating audio for response in ${language}`);
        const ttsResult = await ttsService.generateSpeech(response.response, language);
        result.audio = {
          audioUrl: ttsResult.audioUrl,
          voiceId: ttsResult.voiceId,
          language: ttsResult.language,
          format: ttsResult.format
        };
        console.log(`✅ Audio generated: ${ttsResult.audioUrl}`);
      } catch (ttsError) {
        console.error('❌ TTS generation failed:', ttsError);
        result.audio = { error: 'Failed to generate audio' };
      }
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Enhanced chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process enhanced chat request',
      details: error.message 
    });
  }
});

// Enhanced voice chat endpoint with TTS and emotion
app.post('/api/voice-chat/enhanced', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const targetLanguage = req.body.language || 'en';
    const generateAudio = req.body.generateAudio === 'true';
    
    console.log('🎵 === ENHANCED VOICE CHAT FLOW STARTED ===');
    console.log('🎵 Received audio file:', req.file.originalname, 'Size:', req.file.size, 'Target Language:', targetLanguage, 'Generate Audio:', generateAudio);

    // Step 1: Read the audio file
    const audioBuffer = require('fs').readFileSync(req.file.path);
    
    // Step 2: Map internal language code to Google Speech language code
    const speechLanguageCode = speechToTextService.mapLanguageCode(targetLanguage);
    console.log('🌐 Speech recognition language code:', speechLanguageCode);
    
    // Step 3: Transcribe the audio with the specified language
    const transcription = await speechToTextService.transcribeAudio(audioBuffer, speechLanguageCode);
    console.log('📝 STEP 1 - Transcription result:', transcription);
    
    // Step 4: Detect the language of the transcription
    const detectedLanguage = await translationService.detectLanguage(transcription);
    console.log('🔍 STEP 2 - Detected language of transcription:', detectedLanguage);
    
    let englishMessage = transcription;
    
    // Step 5: Translate to English if not already English
    if (detectedLanguage !== 'en') {
      console.log('🌐 STEP 3 - Translating from', detectedLanguage, 'to English');
      try {
        englishMessage = await translationService.translateText(transcription, 'en');
        console.log('✅ STEP 4 - Translated to English:', englishMessage);
      } catch (translationError) {
        console.error('❌ Translation error:', translationError);
        englishMessage = transcription;
      }
    } else {
      console.log('✅ STEP 4 - Already in English, no translation needed');
    }
    
    // Step 6: Get AI response using English text
    console.log('🤖 STEP 5 - Getting AI response for:', englishMessage);
    const aiResponse = await aiService.generateResponse(englishMessage, [], 'en');
    console.log('✅ STEP 6 - AI Response in English:', aiResponse.response);
    
    // Step 7: Translate AI response back to target language if needed
    let finalResponse = aiResponse.response;
    if (targetLanguage !== 'en') {
      console.log('🌐 STEP 7 - Translating AI response to', targetLanguage);
      try {
        finalResponse = await translationService.translateText(aiResponse.response, targetLanguage);
        console.log('✅ STEP 8 - Final response in', targetLanguage + ':', finalResponse);
      } catch (translationError) {
        console.error('❌ Response translation error:', translationError);
        finalResponse = aiResponse.response;
      }
    } else {
      console.log('✅ STEP 8 - Response already in English');
    }

    // Step 9: Detect emotions in the final response
    const emotionResult = await emotionService.detectEmotion(finalResponse, targetLanguage);
    console.log('😊 STEP 9 - Response emotion:', emotionResult.primaryEmotion);

    const result = {
      success: true, 
      transcription: transcription,
      detectedLanguage: detectedLanguage,
      englishMessage: englishMessage,
      aiResponse: aiResponse.response,
      finalResponse: finalResponse,
      targetLanguage: targetLanguage,
      speechLanguageCode: speechLanguageCode,
      emotion: {
        primaryEmotion: emotionResult.primaryEmotion,
        confidence: emotionResult.confidence,
        emotions: emotionResult.emotions,
        wordMapping: emotionResult.wordMapping,
        emotionColor: emotionService.getEmotionColor(emotionResult.primaryEmotion),
        emotionIcon: emotionService.getEmotionIcon(emotionResult.primaryEmotion),
        emotionDescription: emotionService.getEmotionDescription(emotionResult.primaryEmotion)
      },
      timestamp: new Date().toISOString()
    };

    // Step 10: Generate audio if requested
    if (generateAudio) {
      try {
        console.log('🔊 STEP 10 - Generating audio for response');
        const ttsResult = await ttsService.generateSpeech(finalResponse, targetLanguage);
        result.audio = {
          audioUrl: ttsResult.audioUrl,
          voiceId: ttsResult.voiceId,
          language: ttsResult.language,
          format: ttsResult.format
        };
        console.log('✅ Audio generated:', ttsResult.audioUrl);
      } catch (ttsError) {
        console.error('❌ TTS generation failed:', ttsError);
        result.audio = { error: 'Failed to generate audio' };
      }
    }
    
    // Clean up the uploaded file
    require('fs').unlinkSync(req.file.path);
    
    console.log('🎵 === ENHANCED VOICE CHAT FLOW COMPLETED ===');
    
    res.json(result);

  } catch (error) {
    console.error('❌ Enhanced voice chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process enhanced voice chat',
      details: error.message 
    });
  }
});

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/dubbing', dubbingRoutes);

// Socket.IO event handlers for real-time customer care
io.on('connection', (socket) => {
  console.log('🔗 Client connected:', socket.id);

  // Join a customer care session
  socket.on('join_care_session', async (data) => {
    try {
      console.log(`🎧 Customer ${data.customerId} joining care session for project ${data.projectId}`);
      const session = await customerCareService.initializeSession(
        data.customerId,
        data.projectId,
        data.language,
        data.customerInfo
      );
      socket.join(session.sessionId);
      socket.emit('care_session_joined', session);
    } catch (error) {
      console.error('Failed to join care session:', error);
      socket.emit('care_error', { error: error.message });
    }
  });

  // Handle text message from customer
  socket.on('care_message', async (data) => {
    try {
      await customerCareService.handleCustomerMessage(
        data.sessionId,
        data.message,
        data.messageType
      );
    } catch (error) {
      console.error('Failed to handle care message:', error);
      socket.emit('care_error', { error: error.message });
    }
  });

  // Handle voice message from customer
  socket.on('care_voice_message', async (data) => {
    try {
      await customerCareService.handleVoiceMessage(
        data.sessionId,
        data.audioBuffer
      );
    } catch (error) {
      console.error('Failed to handle care voice message:', error);
      socket.emit('care_error', { error: error.message });
    }
  });

  // Handle session ending
  socket.on('end_care_session', async (data) => {
    try {
      const { sessionId, satisfactionRating, feedback } = data;
      console.log(`🎧 Ending care session: ${sessionId}`);
      
      const summary = await customerCareService.endSession(
        sessionId, 
        satisfactionRating, 
        feedback
      );
      
      socket.emit('care_session_summary', summary);
      socket.leave(sessionId);
      
      console.log(`✅ Care session ended: ${sessionId}`);
    } catch (error) {
      console.error('Failed to end care session:', error);
      socket.emit('care_error', { error: error.message });
    }
  });

  // Get session info
  socket.on('get_session_info', (data) => {
    try {
      const { sessionId } = data;
      const sessionInfo = customerCareService.getSessionInfo(sessionId);
      socket.emit('session_info', sessionInfo);
    } catch (error) {
      console.error('Failed to get session info:', error);
      socket.emit('care_error', { error: error.message });
    }
  });

  // Admin: Get all active sessions
  socket.on('get_active_sessions', () => {
    try {
      const activeSessions = customerCareService.getActiveSessions();
      socket.emit('active_sessions', activeSessions);
    } catch (error) {
      console.error('Failed to get active sessions:', error);
      socket.emit('care_error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Start server with Socket.IO
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Socket.IO enabled for real-time customer care`);
  console.log(`🎧 WebSocket TTS connections: ${customerCareService.webSocketTTS.getActiveConnectionsCount()}`);
}); 