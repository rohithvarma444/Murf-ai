const WebSocketTTSService = require('./websocketTTSService');
const AIService = require('./aiService');
const TranslationService = require('./translationService');
const EmotionService = require('./emotionService');
const SpeechToTextService = require('./speechToTextService');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class CustomerCareService {
  constructor(io) {
    this.io = io; // Socket.IO instance
    this.webSocketTTS = new WebSocketTTSService(io);
    this.aiService = AIService;
    this.translationService = new TranslationService();
    this.emotionService = new EmotionService();
    this.speechToTextService = SpeechToTextService;
    
    // Store active customer care sessions
    this.activeSessions = new Map();
    this.customerQueues = new Map(); // Queue management for busy periods
    
    console.log('🎧 Customer Care Service initialized');
    
    // Set up periodic cleanup
    setInterval(() => {
      this.cleanupInactiveSessions();
      this.webSocketTTS.cleanupInactiveConnections();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Initialize customer care session
   * @param {string} customerId - Customer identifier
   * @param {string} projectId - Project identifier
   * @param {string} language - Customer's preferred language
   * @param {Object} customerInfo - Additional customer information
   * @returns {Promise<Object>} Session details
   */
  async initializeSession(customerId, projectId, language = 'en', customerInfo = {}) {
    try {
      const sessionId = `care_${customerId}_${Date.now()}`;
      
      console.log(`🎧 Initializing customer care session: ${sessionId}`);
      
      // Create WebSocket TTS connection with error handling
      let ttsConnectionEstablished = false;
      try {
        await this.webSocketTTS.createConnection(sessionId, language);
        ttsConnectionEstablished = true;
        console.log(`✅ TTS connection established for session: ${sessionId}`);
      } catch (ttsError) {
        console.warn(`⚠️ TTS connection failed for session ${sessionId}:`, ttsError.message);
        // Continue without TTS - session will work with text-only responses
      }
      
      // Get project information for context
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { documents: true }
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Create session record
      const session = {
        sessionId,
        customerId,
        projectId,
        language,
        customerInfo,
        project: {
          id: project.id,
          name: project.name,
          description: project.description
        },
        status: 'active',
        createdAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        avgResponseTime: 0,
        customerSatisfaction: null,
        tags: [],
        priority: 'normal',
        ttsEnabled: ttsConnectionEstablished
      };

      this.activeSessions.set(sessionId, session);
      
      // Send welcome message
      const welcomeMessage = await this.generateWelcomeMessage(project, language);
      await this.sendAIResponse(sessionId, welcomeMessage, 'welcome');

      console.log(`✅ Customer care session initialized: ${sessionId}`);
      
      return {
        sessionId,
        status: 'active',
        project: session.project,
        welcomeMessage,
        ttsEnabled: ttsConnectionEstablished
      };

    } catch (error) {
      console.error('Failed to initialize customer care session:', error);
      throw error;
    }
  }

  /**
   * Handle customer message in care session
   * @param {string} sessionId - Session identifier
   * @param {string} message - Customer message
   * @param {string} messageType - Type of message (text, voice, etc.)
   * @returns {Promise<Object>} AI response
   */
  async handleCustomerMessage(sessionId, message, messageType = 'text') {
    let session;
    try {
      session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      console.log(`🎧 Handling customer message in session ${sessionId}: "${message.substring(0, 100)}..."`);
      
      const startTime = Date.now();
      
      // Update session activity
      session.lastActivity = new Date();
      session.messageCount += 1;

      // Detect emotion in customer message
      const emotion = await this.emotionService.detectEmotion(message, session.language);
      
      // Check if customer needs priority handling based on emotion
      if (this.needsPriorityHandling(emotion)) {
        session.priority = 'high';
        session.tags.push('emotional_escalation');
      }

      // Generate AI response using project context
      const aiResponse = await this.aiService.processChatMessage(
        session.projectId, 
        message, 
        session.language
      );

      // Enhance response for customer care context
      const enhancedResponse = await this.enhanceForCustomerCare(
        aiResponse.response, 
        emotion, 
        session
      );

      // Send response via WebSocket TTS for real-time audio
      await this.sendAIResponse(sessionId, enhancedResponse, 'response');

      // Calculate and update response time
      const responseTime = Date.now() - startTime;
      session.avgResponseTime = (session.avgResponseTime + responseTime) / session.messageCount;

      // Emit to frontend via Socket.IO
      this.io.to(sessionId).emit('care_response', {
        sessionId,
        message: enhancedResponse,
        emotion: emotion,
        responseTime,
        aiContext: aiResponse.context,
        sessionStats: {
          messageCount: session.messageCount,
          avgResponseTime: session.avgResponseTime,
          priority: session.priority,
        },
        timestamp: new Date()
      });

      console.log(`✅ Customer care response sent for session ${sessionId}`);
      
      return {
        response: enhancedResponse,
        emotion,
        responseTime,
        sessionStats: {
          messageCount: session.messageCount,
          avgResponseTime: session.avgResponseTime,
          priority: session.priority
        }
      };

    } catch (error) {
      console.error(`Failed to handle customer message for session ${sessionId}:`, error);
      
      // Send error response
      const errorMessage = await this.translateErrorMessage(session?.language || 'en');
      await this.sendAIResponse(sessionId, errorMessage, 'error');
      
      throw error;
    }
  }

  /**
   * Handle customer voice message in care session
   * @param {string} sessionId - Session identifier
   * @param {Buffer} audioBuffer - Audio data
   * @returns {Promise<Object>} AI response
   */
  async handleVoiceMessage(sessionId, audioBuffer) {
    let session;
    try {
      session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      console.log(`🎤 Handling voice message for session ${sessionId}`);

      // Transcribe audio to text
      const languageCode = this.speechToTextService.mapLanguageCode(session.language);
      const transcript = await this.speechToTextService.transcribeAudio(audioBuffer, languageCode);

      if (!transcript) {
        // If transcription fails, send a message asking to repeat
        const repeatMessage = await this.translationService.translateText(
          "I'm sorry, I couldn't understand what you said. Could you please repeat that?",
          session.language
        );
        await this.sendAIResponse(sessionId, repeatMessage, 'error');
        return { response: repeatMessage };
      }

      console.log(`📝 Voice transcribed to: "${transcript}"`);

      // Process the transcribed text as a regular message
      return await this.handleCustomerMessage(sessionId, transcript, 'voice');

    } catch (error) {
      console.error(`Failed to handle voice message for session ${sessionId}:`, error);
      const language = session ? session.language : 'en';
      const errorMessage = await this.translateErrorMessage(language);
      await this.sendAIResponse(sessionId, errorMessage, 'error');
      throw error;
    }
  }

  /**
   * Send AI response via WebSocket TTS
   * @param {string} sessionId - Session identifier
   * @param {string} message - AI response message
   * @param {string} messageType - Type of message
   * @returns {Promise<boolean>} Success status
   */
  async sendAIResponse(sessionId, message, messageType = 'response') {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Try to send text to WebSocket TTS for real-time audio generation
      let ttsSuccess = false;
      if (session.ttsEnabled) {
        try {
          await this.webSocketTTS.sendText(sessionId, message);
          ttsSuccess = true;
        } catch (ttsError) {
          console.warn(`⚠️ TTS failed for session ${sessionId}:`, ttsError.message);
          // Disable TTS for this session if it fails
          session.ttsEnabled = false;
        }
      }
      
      // Always emit text message via Socket.IO
      this.io.to(sessionId).emit('care_message', {
        sessionId,
        message,
        type: messageType, // 'welcome', 'response', 'error'
        sender: 'ai',
        timestamp: new Date(),
        ttsEnabled: ttsSuccess
      });

      return true;
    } catch (error) {
      console.error(`Failed to send AI response for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Generate welcome message for customer
   * @param {Object} project - Project information
   * @param {string} language - Target language
   * @returns {Promise<string>} Welcome message
   */
  async generateWelcomeMessage(project, language) {
    const englishMessage = `Hello! I'm your AI assistant for ${project.name}. I'm here to help you with any questions about our services. How can I assist you today?`;
    
    if (language === 'en') {
      return englishMessage;
    }

    try {
      return await this.translationService.translateText(englishMessage, language);
    } catch (error) {
      console.error('Failed to translate welcome message:', error);
      return englishMessage;
    }
  }

  /**
   * Enhance AI response for customer care context
   * @param {string} response - Original AI response
   * @param {Object} emotion - Customer emotion data
   * @param {Object} session - Session information
   * @returns {Promise<string>} Enhanced response
   */
  async enhanceForCustomerCare(response, emotion, session) {
    try {
      // Add empathy if customer is negative
      if (emotion && emotion.primaryEmotion) {
        const negativeEmotions = ['angry', 'sad', 'frustrated', 'disappointed'];
        
        if (negativeEmotions.includes(emotion.primaryEmotion.toLowerCase())) {
          const empathyPrefix = session.language === 'en' 
            ? "I understand this might be frustrating. " 
            : await this.translationService.translateText("I understand this might be frustrating. ", session.language);
          
          return empathyPrefix + response;
        }
        
        // Add enthusiasm for positive emotions
        const positiveEmotions = ['happy', 'excited', 'satisfied'];
        if (positiveEmotions.includes(emotion.primaryEmotion.toLowerCase())) {
          const enthusiasmSuffix = session.language === 'en' 
            ? " I'm glad I could help!" 
            : await this.translationService.translateText(" I'm glad I could help!", session.language);
          
          return response + enthusiasmSuffix;
        }
      }

      return response;
    } catch (error) {
      console.error('Failed to enhance response for customer care:', error);
      return response;
    }
  }

  /**
   * Check if customer needs priority handling
   * @param {Object} emotion - Emotion analysis result
   * @returns {boolean} Needs priority handling
   */
  needsPriorityHandling(emotion) {
    if (!emotion || !emotion.primaryEmotion) return false;
    
    const priorityEmotions = ['angry', 'frustrated', 'disappointed'];
    const confidenceThreshold = 0.7;
    
    return priorityEmotions.includes(emotion.primaryEmotion.toLowerCase()) && 
           emotion.confidence > confidenceThreshold;
  }

  /**
   * End customer care session
   * @param {string} sessionId - Session identifier
   * @param {number} satisfactionRating - Customer satisfaction (1-5)
   * @param {string} feedback - Optional feedback
   * @returns {Promise<Object>} Session summary
   */
  async endSession(sessionId, satisfactionRating = null, feedback = null) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      console.log(`🎧 Ending customer care session: ${sessionId}`);
      
      // Close WebSocket TTS connection
      await this.webSocketTTS.closeConnection(sessionId);
      
      // Update session with final data
      session.status = 'ended';
      session.endedAt = new Date();
      session.customerSatisfaction = satisfactionRating;
      session.feedback = feedback;
      session.duration = session.endedAt.getTime() - session.createdAt.getTime();

      // Generate session summary
      const summary = {
        sessionId,
        duration: session.duration,
        messageCount: session.messageCount,
        avgResponseTime: session.avgResponseTime,
        customerSatisfaction: satisfactionRating,
        priority: session.priority,
        tags: session.tags,
        feedback
      };

      // Store session data for analytics (could be in database)
      console.log(`📊 Session summary for ${sessionId}:`, summary);
      
      // Remove from active sessions
      this.activeSessions.delete(sessionId);
      
      // Emit session end to frontend
      this.io.to(sessionId).emit('care_session_ended', summary);

      return summary;
    } catch (error) {
      console.error(`Failed to end session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get session information
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Session information
   */
  getSessionInfo(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId: session.sessionId,
      customerId: session.customerId,
      projectId: session.projectId,
      language: session.language,
      status: session.status,
      messageCount: session.messageCount,
      avgResponseTime: session.avgResponseTime,
      priority: session.priority,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      wsConnectionInfo: this.webSocketTTS.getConnectionInfo(sessionId)
    };
  }

  /**
   * Get all active sessions
   * @returns {Array} Array of active session information
   */
  getActiveSessions() {
    const sessions = [];
    for (const [sessionId] of this.activeSessions) {
      sessions.push(this.getSessionInfo(sessionId));
    }
    return sessions;
  }

  /**
   * Translate error message
   * @param {string} language - Target language
   * @returns {Promise<string>} Translated error message
   */
  async translateErrorMessage(language) {
    const englishError = "I apologize, but I'm experiencing some technical difficulties. Please try again in a moment.";
    
    if (language === 'en') {
      return englishError;
    }

    try {
      return await this.translationService.translateText(englishError, language);
    } catch (error) {
      return englishError;
    }
  }

  /**
   * Clean up inactive sessions
   */
  cleanupInactiveSessions() {
    const now = new Date();
    const inactivityTimeout = 30 * 60 * 1000; // 30 minutes
    const sessionsToCleanup = [];

    for (const [sessionId, session] of this.activeSessions) {
      const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
      
      if (timeSinceLastActivity > inactivityTimeout) {
        sessionsToCleanup.push(sessionId);
      }
    }

    sessionsToCleanup.forEach(sessionId => {
      console.log(`🧹 Cleaning up inactive customer care session: ${sessionId}`);
      this.endSession(sessionId, null, 'Session ended due to inactivity');
    });
  }
}

module.exports = CustomerCareService; 