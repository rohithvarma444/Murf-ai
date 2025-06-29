const axios = require('axios');

class TTSService {
  constructor() {
    this.apiKey = process.env.MURF_API_KEY;
    this.baseURL = 'https://api.murf.ai/v1';
    
    // Debug logging
    console.log('🔊 TTSService initialized');
    console.log('🔑 MURF_API_KEY:', this.apiKey ? 'Set' : 'Not set');
  }

  /**
   * Get voice ID based on language
   * @param {string} language - Language code (en, hi, bn, ta, etc.)
   * @returns {string} Voice ID for the language
   */
  getVoiceId(language) {
    // Map language codes to Murf voice IDs based on official voice library
    const voiceMap = {
      'en': 'en-US-natalie',      // English - Natalie (supports en-US, es-ES, fr-FR)
      'hi': 'hi-IN-ayushi',       // Hindi - Ayushi (supports hi-IN)
      'bn': 'bn-IN-anwesha',      // Bengali - Anwesha (supports Bengali)
      'ta': 'ta-IN-iniya',        // Tamil - Iniya (supports Tamil)
      'es': 'es-ES-elvira',       // Spanish - Elvira (supports es-ES)
      'fr': 'fr-FR-adélie',       // French - Adelie (supports fr-FR)
      'de': 'de-DE-matthias',     // German - Matthias (supports de-DE, en-US)
      'it': 'it-IT-lorenzo',      // Italian - Lorenzo (supports it-IT)
      'nl': 'nl-NL-dirk',         // Dutch - Dirk (supports Dutch)
      'pt': 'pt-BR-heitor',       // Portuguese - Heitor (supports pt-BR)
      'zh': 'zh-CN-tao',          // Chinese - Tao (supports zh-CN)
      'ja': 'ja-JP-kenji',        // Japanese - Kenji (supports ja-JP)
      'ko': 'ko-KR-gyeong',       // Korean - Gyeong (supports ko-KR)
      'hr': 'hr-HR-marija',       // Croatian - Marija (supports hr-HR)
      'sk': 'sk-SK-tibor',        // Slovak - Tibor (supports sk-SK)
      'pl': 'pl-PL-jacek',        // Polish - Jacek (supports pl-PL)
      'el': 'el-GR-stavros',      // Greek - Stavros (supports el-GR)
    };

    return voiceMap[language] || 'en-US-natalie'; // Default to English
  }

  /**
   * Generate speech from text using Murf AI API
   * @param {string} text - Text to convert to speech
   * @param {string} language - Language code for voice selection
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Audio file URL and metadata
   */
  async generateSpeech(text, language = 'en', options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('MURF_API_KEY not configured');
      }

      if (!text || !text.trim()) {
        throw new Error('Text is required for speech generation');
      }

      const voiceId = this.getVoiceId(language);
      
      console.log(`🔊 Generating speech for language: ${language}`);
      console.log(`🎤 Using voice: ${voiceId}`);
      console.log(`📝 Text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

      const requestData = {
        text: text,
        voiceId: voiceId,
        format: options.format || 'MP3',
        channelType: options.channelType || 'MONO',
        sampleRate: options.sampleRate || 24000,
        encodeAsBase64: options.encodeAsBase64 || false
      };

      console.log('🎵 TTS Request:', JSON.stringify(requestData, null, 2));

      const response = await axios.post(
        `${this.baseURL}/speech/generate`,
        requestData,
        {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 60000 // 60 second timeout for audio generation
        }
      );

      console.log('🔊 TTS Response received');

      if (response.data && response.data.audioFile) {
        const result = {
          audioUrl: response.data.audioFile,
          voiceId: voiceId,
          language: language,
          textLength: text.length,
          format: requestData.format,
          timestamp: new Date().toISOString()
        };

        console.log(`✅ Speech generated successfully: ${result.audioUrl}`);
        return result;
      } else {
        console.error('❌ Invalid TTS response structure:', response.data);
        throw new Error('Invalid response from Murf TTS API');
      }

    } catch (error) {
      console.error('TTS generation error:', error);
      
      if (error.response) {
        console.error('API Error Response:', error.response.data);
        throw new Error(`TTS API error: ${error.response.data.errorMessage || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('TTS service unavailable');
      } else {
        throw new Error(`TTS generation failed: ${error.message}`);
      }
    }
  }

  /**
   * Get available voices for a language
   * @param {string} language - Language code
   * @returns {Array} Array of available voice IDs
   */
  getAvailableVoices(language) {
    const allVoices = {
      'en': ['en-US-natalie', 'en-US-terrell', 'en-US-julia', 'en-US-miles', 'en-US-amara'],
      'hi': ['hi-IN-ayushi', 'hi-IN-shaan', 'hi-IN-shweta'],
      'bn': ['bn-IN-anwesha', 'bn-IN-ishani', 'bn-IN-abhik', 'bn-IN-arnab'],
      'ta': ['ta-IN-iniya', 'ta-IN-mani'],
      'es': ['es-ES-elvira', 'es-ES-enrique', 'es-ES-carmen', 'es-ES-javier'],
      'fr': ['fr-FR-adélie', 'fr-FR-maxime', 'fr-FR-axel', 'fr-FR-justine'],
      'de': ['de-DE-matthias', 'de-DE-lia', 'de-DE-björn', 'de-DE-erna'],
      'it': ['it-IT-lorenzo', 'it-IT-greta', 'it-IT-vincenzo', 'it-IT-giorgio'],
      'nl': ['nl-NL-dirk', 'nl-NL-merel', 'nl-NL-famke'],
      'pt': ['pt-BR-heitor', 'pt-BR-isadora', 'pt-BR-eloa', 'pt-BR-benício'],
      'zh': ['zh-CN-tao', 'zh-CN-jiao', 'zh-CN-baolin', 'zh-CN-wei'],
      'ja': ['ja-JP-kenji', 'ja-JP-kimi', 'ja-JP-denki'],
      'ko': ['ko-KR-gyeong', 'ko-KR-hwan', 'ko-KR-jangmi', 'ko-KR-jong-su'],
      'hr': ['hr-HR-marija'],
      'sk': ['sk-SK-tibor', 'sk-SK-nina'],
      'pl': ['pl-PL-jacek', 'pl-PL-kasia', 'pl-PL-blazej'],
      'el': ['el-GR-stavros']
    };

    return allVoices[language] || allVoices['en'];
  }

  /**
   * Get supported languages
   * @returns {Array} Array of supported language codes
   */
  getSupportedLanguages() {
    return [
      'en', 'hi', 'bn', 'ta', 'es', 'fr', 'de', 'it', 'nl', 'pt',
      'zh', 'ja', 'ko', 'hr', 'sk', 'pl', 'el'
    ];
  }
}

module.exports = TTSService; 