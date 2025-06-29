const speech = require('@google-cloud/speech');
const path = require('path');

class SpeechToTextService {
  constructor() {
    // Initialize Google Cloud Speech client with service account key
    const keyFilePath = path.join(__dirname, '../murph.json');
    
    this.speechClient = new speech.SpeechClient({
      keyFilename: keyFilePath,
    });
  }

  /**
   * Transcribe audio buffer to text
   * @param {Buffer} audioBuffer - Raw audio data
   * @param {string} languageCode - Language code (default: 'en-US')
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeAudio(audioBuffer, languageCode = 'en-US') {
    try {
      console.log(`🎤 Transcribing audio (${audioBuffer.length} bytes) for language: ${languageCode}`);

      // Enhanced configuration for better accuracy
      const config = {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: languageCode,
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
        enableWordConfidence: false,
        model: 'latest_long',
        useEnhanced: true,
      };

      // Add language-specific enhancements
      if (languageCode.startsWith('hi-') || languageCode.startsWith('ta-') || languageCode.startsWith('bn-')) {
        // For Indian languages, use enhanced model and add hints
        config.model = 'latest_long';
        config.useEnhanced = true;
        console.log(`🇮🇳 Using enhanced model for Indian language: ${languageCode}`);
      }

      // Configure the recognition request
      const request = {
        audio: {
          content: audioBuffer.toString('base64'),
        },
        config: config,
      };

      // Perform the transcription
      const [response] = await this.speechClient.recognize(request);
      
      if (!response.results || response.results.length === 0) {
        console.log('📝 No transcription results found');
        return '';
      }

      // Extract the transcript
      const transcript = response.results
        .map(result => result.alternatives[0].transcript)
        .join(' ');

      console.log(`📝 Transcription completed: "${transcript}"`);
      return transcript.trim();

    } catch (error) {
      console.error('❌ Transcription error:', error);
      
      // If WebM_OPUS fails, try with LINEAR16 as fallback
      if (error.message && error.message.includes('encoding')) {
        console.log('🔄 Trying fallback encoding (LINEAR16)...');
        try {
          const fallbackRequest = {
            audio: {
              content: audioBuffer.toString('base64'),
            },
            config: {
              encoding: 'LINEAR16',
              sampleRateHertz: 16000,
              languageCode: languageCode,
              enableAutomaticPunctuation: true,
              enableWordTimeOffsets: false,
              enableWordConfidence: false,
              model: 'latest_long',
              useEnhanced: true,
            },
          };

          const [fallbackResponse] = await this.speechClient.recognize(fallbackRequest);
          
          if (!fallbackResponse.results || fallbackResponse.results.length === 0) {
            console.log('📝 No transcription results found with fallback encoding');
            return '';
          }

          const transcript = fallbackResponse.results
            .map(result => result.alternatives[0].transcript)
            .join(' ');

          console.log(`📝 Transcription completed with fallback: "${transcript}"`);
          return transcript.trim();
        } catch (fallbackError) {
          console.error('❌ Fallback transcription also failed:', fallbackError);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }

  /**
   * Map internal language code to Google Speech language code
   * @param {string} internalCode - Internal language code
   * @returns {string} Google Speech language code
   */
  mapLanguageCode(internalCode) {
    const languageMap = {
      // English variants
      'en': 'en-US',
      'en-US': 'en-US',
      'en-GB': 'en-GB',
      'en-AU': 'en-AU',
      
      // Indian languages with specific regional codes
      'hi': 'hi-IN',
      'hi-IN': 'hi-IN',
      'ta': 'ta-IN',
      'ta-IN': 'ta-IN',
      'bn': 'bn-IN',
      'bn-IN': 'bn-IN',
      'te': 'te-IN', // Telugu
      'mr': 'mr-IN', // Marathi
      'gu': 'gu-IN', // Gujarati
      'kn': 'kn-IN', // Kannada
      'ml': 'ml-IN', // Malayalam
      'pa': 'pa-IN', // Punjabi
      'or': 'or-IN', // Odia
      'as': 'as-IN', // Assamese
      
      // Other major languages
      'es': 'es-ES',
      'es-ES': 'es-ES',
      'es-MX': 'es-MX',
      'fr': 'fr-FR',
      'fr-FR': 'fr-FR',
      'fr-CA': 'fr-CA',
      'de': 'de-DE',
      'de-DE': 'de-DE',
      'it': 'it-IT',
      'it-IT': 'it-IT',
      'pt': 'pt-BR',
      'pt-BR': 'pt-BR',
      'pt-PT': 'pt-PT',
      'ru': 'ru-RU',
      'ru-RU': 'ru-RU',
      'ja': 'ja-JP',
      'ja-JP': 'ja-JP',
      'ko': 'ko-KR',
      'ko-KR': 'ko-KR',
      'zh': 'zh-CN',
      'zh-CN': 'zh-CN',
      'zh-TW': 'zh-TW',
      'ar': 'ar-SA',
      'ar-SA': 'ar-SA',
      'tr': 'tr-TR',
      'tr-TR': 'tr-TR',
      'nl': 'nl-NL',
      'nl-NL': 'nl-NL',
      'pl': 'pl-PL',
      'pl-PL': 'pl-PL'
    };

    const mappedCode = languageMap[internalCode];
    if (mappedCode) {
      console.log(`🌐 Language mapping: ${internalCode} → ${mappedCode}`);
      return mappedCode;
    }
    
    console.log(`⚠️ Unknown language code: ${internalCode}, defaulting to en-US`);
    return 'en-US';
  }

  /**
   * Get supported languages
   * @returns {Array} Array of supported language objects
   */
  getSupportedLanguages() {
    return [
      { code: 'en', name: 'English', speechCode: 'en-US' },
      { code: 'hi', name: 'Hindi', speechCode: 'hi-IN' },
      { code: 'ta', name: 'Tamil', speechCode: 'ta-IN' },
      { code: 'bn', name: 'Bengali', speechCode: 'bn-IN' },
      { code: 'es', name: 'Spanish', speechCode: 'es-ES' },
      { code: 'fr', name: 'French', speechCode: 'fr-FR' },
      { code: 'de', name: 'German', speechCode: 'de-DE' },
      { code: 'it', name: 'Italian', speechCode: 'it-IT' },
      { code: 'pt', name: 'Portuguese', speechCode: 'pt-BR' },
      { code: 'ru', name: 'Russian', speechCode: 'ru-RU' },
      { code: 'ja', name: 'Japanese', speechCode: 'ja-JP' },
      { code: 'ko', name: 'Korean', speechCode: 'ko-KR' },
      { code: 'zh', name: 'Chinese', speechCode: 'zh-CN' },
      { code: 'ar', name: 'Arabic', speechCode: 'ar-SA' },
      { code: 'tr', name: 'Turkish', speechCode: 'tr-TR' },
      { code: 'nl', name: 'Dutch', speechCode: 'nl-NL' },
      { code: 'pl', name: 'Polish', speechCode: 'pl-PL' }
    ];
  }
}

module.exports = new SpeechToTextService(); 