const WebSocket = require('ws');

class WebSocketTTSService {
  constructor(io) {
    this.io = io; // Socket.IO instance
    this.apiKey = process.env.MURF_API_KEY;
    this.wsUrl = 'wss://api.murf.ai/v1/speech/stream-input'; // Corrected endpoint
    this.activeConnections = new Map(); // Store active WebSocket connections
    
    // Connection limits and management
    this.maxConnections = parseInt(process.env.MAX_TTS_CONNECTIONS) || 10; // Default limit
    this.connectionQueue = []; // Queue for pending connections
    this.retryAttempts = 3; // Number of retry attempts
    this.retryDelay = 2000; // Delay between retries in ms
    
    console.log('🔗 WebSocket TTS Service initialized');
    console.log('🔑 MURF_API_KEY:', this.apiKey ? 'Set' : 'Not set');
    console.log(`📊 Max connections: ${this.maxConnections}`);
  }

  /**
   * Create a new WebSocket connection for real-time TTS
   * @param {string} sessionId - Unique session identifier
   * @param {string} language - Target language for TTS
   * @param {string} voiceId - Voice ID for TTS
   * @returns {Promise<WebSocket>} WebSocket connection
   */
  async createConnection(sessionId, language = 'en', voiceId = null) {
    try {
      if (!this.apiKey) {
        throw new Error('MURF_API_KEY not configured');
      }

      // Check if connection already exists
      if (this.activeConnections.has(sessionId)) {
        console.log(`🔄 Reusing existing connection for session: ${sessionId}`);
        return this.activeConnections.get(sessionId).ws;
      }

      // Check connection limit
      if (this.activeConnections.size >= this.maxConnections) {
        console.log(`⚠️ Connection limit reached (${this.maxConnections}). Queueing connection for session: ${sessionId}`);
        return this.queueConnection(sessionId, language, voiceId);
      }

      return await this.establishConnection(sessionId, language, voiceId);

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      throw error;
    }
  }

  /**
   * Queue a connection when limit is reached
   * @param {string} sessionId - Session identifier
   * @param {string} language - Language
   * @param {string} voiceId - Voice ID
   * @returns {Promise<WebSocket>} WebSocket connection
   */
  async queueConnection(sessionId, language, voiceId) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        sessionId,
        language,
        voiceId,
        resolve,
        reject,
        timestamp: Date.now()
      };

      this.connectionQueue.push(queueItem);

      // Set timeout for queued connections
      setTimeout(() => {
        const index = this.connectionQueue.findIndex(item => item.sessionId === sessionId);
        if (index !== -1) {
          this.connectionQueue.splice(index, 1);
          reject(new Error('Connection request timed out'));
        }
      }, 30000); // 30 second timeout

      // Try to process queue
      this.processConnectionQueue();
    });
  }

  /**
   * Process the connection queue
   */
  async processConnectionQueue() {
    if (this.connectionQueue.length === 0) return;
    if (this.activeConnections.size >= this.maxConnections) return;

    const queueItem = this.connectionQueue.shift();
    if (!queueItem) return;

    try {
      const ws = await this.establishConnection(queueItem.sessionId, queueItem.language, queueItem.voiceId);
      queueItem.resolve(ws);
    } catch (error) {
      queueItem.reject(error);
    }
  }

  /**
   * Establish a WebSocket connection with retry logic
   * @param {string} sessionId - Session identifier
   * @param {string} language - Language
   * @param {string} voiceId - Voice ID
   * @returns {Promise<WebSocket>} WebSocket connection
   */
  async establishConnection(sessionId, language = 'en', voiceId = null) {
    let lastError;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`🔗 Attempting WebSocket connection for session ${sessionId} (attempt ${attempt}/${this.retryAttempts})`);

        // Correctly format the URL with query parameters
        const params = new URLSearchParams({
          'api-key': this.apiKey,
          'sample_rate': 44100,
          'channel_type': 'MONO',
          'format': 'MP3'
        });
        const url = `${this.wsUrl}?${params.toString()}`;

        const ws = new WebSocket(url);

        return await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('WebSocket connection timeout'));
          }, 10000);

          ws.on('open', () => {
            clearTimeout(timeout);
            console.log(`🔗 WebSocket connection opened for session: ${sessionId}`);
            
            this.activeConnections.set(sessionId, {
              ws: ws,
              language: language,
              voiceId: voiceId || this.getDefaultVoiceId(language),
              createdAt: new Date(),
              lastUsed: new Date()
            });

            // Send initial voice configuration
            const voiceConfig = {
              voice_config: {
                voiceId: voiceId || this.getDefaultVoiceId(language),
                style: 'Conversational',
                rate: 0,
                pitch: 0,
                variation: 1
              }
            };

            ws.send(JSON.stringify(voiceConfig));
            resolve(ws);
          });

          ws.on('error', (error) => {
            clearTimeout(timeout);
            console.error(`❌ WebSocket error for session ${sessionId} (attempt ${attempt}):`, error);
            lastError = error;
            reject(error);
          });

          ws.on('close', (code, reason) => {
            console.log(`🔗 WebSocket connection closed for session: ${sessionId} (code: ${code}, reason: ${reason})`);
            this.activeConnections.delete(sessionId);
            
            // Process queue when connection closes
            this.processConnectionQueue();
          });

          ws.on('message', (data) => {
            try {
              let msgString;
              let json = null;

              if (typeof data === 'string') {
                msgString = data;
              } else if (data instanceof Buffer) {
                // Attempt to parse as JSON string first
                msgString = data.toString('utf8');
              }

              if (msgString) {
                try {
                  json = JSON.parse(msgString);
                } catch (_) {
                  // Not JSON – assume it is binary audio data (rare case)
                }
              }

              if (json && json.audio) {
                // Base64-encoded audio chunk
                const audioBuf = Buffer.from(json.audio, 'base64');
                // Convert to ArrayBuffer for transmission to browser clients
                const arrayBuf = audioBuf.buffer.slice(audioBuf.byteOffset, audioBuf.byteOffset + audioBuf.byteLength);
                if (this.io) {
                  this.io.to(sessionId).emit('care_audio_chunk', {
                    sessionId,
                    audioChunk: arrayBuf,
                    isFinal: json.isFinalAudio || false
                  });
                }
              } else if (json && json.error) {
                console.error(`❌ TTS API error for session ${sessionId}:`, json.error);
                if (this.io) {
                  this.io.to(sessionId).emit('care_error', {
                    sessionId,
                    error: json.error
                  });
                }
              } else if (!json) {
                // Fallback: treat as raw binary audio
                const arrayBuf = data instanceof Buffer ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
                if (this.io) {
                  this.io.to(sessionId).emit('care_audio_chunk', {
                    sessionId,
                    audioChunk: arrayBuf
                  });
                }
              }
            } catch (error) {
              console.error('Error processing WebSocket message:', error);
            }
          });
        });

      } catch (error) {
        lastError = error;
        console.error(`❌ Connection attempt ${attempt} failed for session ${sessionId}:`, error.message);
        
        if (attempt < this.retryAttempts) {
          console.log(`⏳ Retrying in ${this.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    // All attempts failed
    throw new Error(`Failed to establish WebSocket connection after ${this.retryAttempts} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Send text for real-time TTS conversion
   * @param {string} sessionId - Session identifier
   * @param {string} text - Text to convert to speech
   * @returns {Promise<boolean>} Success status
   */
  async sendText(sessionId, text) {
    try {
      const connection = this.activeConnections.get(sessionId);
      
      if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
        throw new Error(`No active WebSocket connection for session: ${sessionId}`);
      }

      if (!text || !text.trim()) {
        throw new Error('Text is required for TTS conversion');
      }

      // Murf expects a JSON payload with the text field (and optional end flag)
      const message = {
        text: text.trim(),
        end: true
      };

      connection.ws.send(JSON.stringify(message));
      connection.lastUsed = new Date();
      
      console.log(`📝 Sent text for TTS conversion in session ${sessionId}: "${text.substring(0, 50)}..."`);
      return true;

    } catch (error) {
      console.error(`Failed to send text for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Handle incoming WebSocket messages
   * @param {string} sessionId - Session identifier
   * @param {Object} message - Parsed message object
   */
  handleWebSocketMessage(sessionId, message) {
    const connection = this.activeConnections.get(sessionId);
    if (!connection) return;

    switch (message.type) {
      case 'audio':
        console.log(`🔊 Received audio data for session ${sessionId}`);
        // Emit audio data to connected clients
        this.emitAudioData(sessionId, message.data);
        break;
        
      case 'error':
        console.error(`❌ TTS error for session ${sessionId}:`, message.error);
        this.emitError(sessionId, message.error);
        break;
        
      case 'config_ack':
        console.log(`✅ Configuration acknowledged for session ${sessionId}`);
        break;
        
      case 'status':
        console.log(`📊 Status update for session ${sessionId}:`, message.status);
        break;
        
      default:
        console.log(`📨 Unknown message type for session ${sessionId}:`, message.type);
    }
  }

  /**
   * Emit audio data to connected clients (to be implemented with Socket.IO)
   * @param {string} sessionId - Session identifier
   * @param {string} audioData - Base64 encoded audio data
   */
  emitAudioData(sessionId, audioData) {
    // This will be connected to Socket.IO to emit to frontend clients
    console.log(`🔊 Emitting audio data for session ${sessionId}`);
    // Implementation will be added when integrating with Socket.IO
  }

  /**
   * Emit error to connected clients
   * @param {string} sessionId - Session identifier
   * @param {string} error - Error message
   */
  emitError(sessionId, error) {
    console.error(`❌ Emitting error for session ${sessionId}:`, error);
    // Implementation will be added when integrating with Socket.IO
  }

  /**
   * Close WebSocket connection for a session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<boolean>} Success status
   */
  async closeConnection(sessionId) {
    try {
      const connection = this.activeConnections.get(sessionId);
      
      if (connection && connection.ws) {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close();
        }
        this.activeConnections.delete(sessionId);
        console.log(`🔗 Closed WebSocket connection for session: ${sessionId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Failed to close connection for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get default voice ID for a language
   * @param {string} language - Language code
   * @returns {string} Default voice ID
   */
  getDefaultVoiceId(language) {
    const defaultVoices = {
      'en': 'en-US-natalie',
      'hi': 'hi-IN-ayushi',
      'bn': 'bn-IN-anwesha',
      'ta': 'ta-IN-iniya',
      'es': 'es-ES-elvira',
      'fr': 'fr-FR-adélie',
      'de': 'de-DE-matthias',
      'it': 'it-IT-lorenzo',
      'nl': 'nl-NL-dirk',
      'pt': 'pt-BR-heitor',
      'zh': 'zh-CN-tao',
      'ja': 'ja-JP-kenji',
      'ko': 'ko-KR-gyeong'
    };

    return defaultVoices[language] || 'en-US-natalie';
  }

  /**
   * Get active connections count
   * @returns {number} Number of active connections
   */
  getActiveConnectionsCount() {
    return this.activeConnections.size;
  }

  /**
   * Get connection info for a session
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Connection info
   */
  getConnectionInfo(sessionId) {
    const connection = this.activeConnections.get(sessionId);
    if (!connection) return null;

    return {
      sessionId: sessionId,
      language: connection.language,
      voiceId: connection.voiceId,
      status: connection.ws.readyState === WebSocket.OPEN ? 'connected' : 'disconnected',
      createdAt: connection.createdAt,
      lastUsed: connection.lastUsed
    };
  }

  /**
   * Clean up inactive connections (call periodically)
   * @param {number} timeoutMs - Timeout in milliseconds (default: 30 minutes)
   */
  cleanupInactiveConnections(timeoutMs = 30 * 60 * 1000) {
    const now = new Date();
    const connectionsToRemove = [];

    for (const [sessionId, connection] of this.activeConnections) {
      const timeSinceLastUsed = now.getTime() - connection.lastUsed.getTime();
      
      if (timeSinceLastUsed > timeoutMs) {
        connectionsToRemove.push(sessionId);
      }
    }

    connectionsToRemove.forEach(sessionId => {
      console.log(`🧹 Cleaning up inactive connection for session: ${sessionId}`);
      this.closeConnection(sessionId);
    });

    if (connectionsToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${connectionsToRemove.length} inactive WebSocket connections`);
    }
  }
}

module.exports = WebSocketTTSService; 