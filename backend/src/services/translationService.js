const axios = require('axios');

class TranslationService {
  constructor() {
    this.apiKey = process.env.MURF_API_KEY;
    this.baseURL = 'https://api.murf.ai/v1';
    
    // Debug logging
    console.log('🔧 TranslationService initialized');
    console.log('🔑 MURF_API_KEY:', this.apiKey ? 'Set' : 'Not set');
  }

  /**
   * Detect the language of the input text
   * @param {string} text - Text to detect language for
   * @returns {Promise<string>} Language code (en, hi, bn, ta, etc.)
   */
  async detectLanguage(text) {
    try {
      // Simple language detection based on character sets
      // This is a basic implementation - in production you might want to use a more sophisticated service
      
      const trimmedText = text.trim();
      if (!trimmedText) return 'en';

      // Check for Tamil characters
      if (/[\u0B80-\u0BFF]/.test(trimmedText)) {
        return 'ta';
      }

      // Check for Bengali characters
      if (/[\u0980-\u09FF]/.test(trimmedText)) {
        return 'bn';
      }

      // Check for Hindi/Devanagari characters
      if (/[\u0900-\u097F]/.test(trimmedText)) {
        return 'hi';
      }

      // Check for Chinese characters
      if (/[\u4E00-\u9FFF]/.test(trimmedText)) {
        return 'zh';
      }

      // Check for Japanese characters
      if (/[\u3040-\u309F\u30A0-\u30FF]/.test(trimmedText)) {
        return 'ja';
      }

      // Check for Korean characters
      if (/[\uAC00-\uD7AF]/.test(trimmedText)) {
        return 'ko';
      }

      // Check for Greek characters
      if (/[\u0370-\u03FF]/.test(trimmedText)) {
        return 'el';
      }

      // Default to English for Latin characters and other scripts
      return 'en';
    } catch (error) {
      console.error('Language detection error:', error);
      return 'en'; // Default fallback
    }
  }

  /**
   * Translate text using Murf AI API
   * @param {string} text - Text to translate
   * @param {string} targetLanguage - Target language code (will be converted to locale)
   * @returns {Promise<string>} Translated text
   */
  async translateText(text, targetLanguage) {
    try {
      if (!this.apiKey) {
        throw new Error('MURF_API_KEY not configured');
      }

      if (!text || !text.trim()) {
        return text;
      }

      // Map internal language codes to Murf API locale codes
      const languageMap = {
        'en': 'en-US',      // English - US & Canada
        'hi': 'hi-IN',      // Hindi - India
        'bn': 'bn-IN',      // Bengali - India
        'ta': 'ta-IN',      // Tamil - India
        'es': 'es-ES',      // Spanish - Spain
        'fr': 'fr-FR',      // French - France
        'de': 'de-DE',      // German - Germany
        'it': 'it-IT',      // Italian - Italy
        'nl': 'nl-NL',      // Dutch - Netherlands
        'pt': 'pt-BR',      // Portuguese - Brazil
        'zh': 'zh-CN',      // Chinese - China
        'ja': 'ja-JP',      // Japanese - Japan
        'ko': 'ko-KR',      // Korean - Korea
        'hr': 'hr-HR',      // Croatian - Croatia
        'sk': 'sk-SK',      // Slovak - Slovakia
        'pl': 'pl-PL',      // Polish - Poland
        'el': 'el-GR',      // Greek - Greece
      };

      const murfTargetLang = languageMap[targetLanguage];

      if (!murfTargetLang) {
        throw new Error(`Unsupported target language: ${targetLanguage}`);
      }

      console.log(`🌐 Translating to ${targetLanguage} (${murfTargetLang})`);
      console.log(`📝 Text: "${text}"`);

      const response = await axios.post(
        `${this.baseURL}/text/translate`,
        {
          texts: [text],
          targetLanguage: murfTargetLang
          // Note: sourceLanguage is not needed - Murf auto-detects
        },
        {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      console.log('🔍 Murf API Response:', JSON.stringify(response.data, null, 2));

      if (response.data && response.data.translations && response.data.translations.length > 0) {
        const translatedText = response.data.translations[0].translated_text;
        console.log(`✅ Translation successful: "${translatedText}"`);
        return translatedText;
      } else {
        console.error('❌ Invalid response structure:', response.data);
        throw new Error('Invalid response from Murf API');
      }

    } catch (error) {
      console.error('Translation error:', error);
      
      if (error.response) {
        console.error('API Error Response:', error.response.data);
        throw new Error(`Translation API error: ${error.response.data.errorMessage || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Translation service unavailable');
      } else {
        throw new Error(`Translation failed: ${error.message}`);
      }
    }
  }

  /**
   * Translate multiple texts in batch
   * @param {Array<string>} texts - Array of texts to translate
   * @param {string} targetLanguage - Target language code (will be converted to locale)
   * @returns {Promise<Array<string>>} Array of translated texts
   */
  async translateMultipleTexts(texts, targetLanguage) {
    try {
      if (!this.apiKey) {
        throw new Error('MURF_API_KEY not configured');
      }

      if (!Array.isArray(texts) || texts.length === 0) {
        return texts;
      }

      // Map internal language codes to Murf API locale codes
      const languageMap = {
        'en': 'en-US',      // English - US & Canada
        'hi': 'hi-IN',      // Hindi - India
        'bn': 'bn-IN',      // Bengali - India
        'ta': 'ta-IN',      // Tamil - India
        'es': 'es-ES',      // Spanish - Spain
        'fr': 'fr-FR',      // French - France
        'de': 'de-DE',      // German - Germany
        'it': 'it-IT',      // Italian - Italy
        'nl': 'nl-NL',      // Dutch - Netherlands
        'pt': 'pt-BR',      // Portuguese - Brazil
        'zh': 'zh-CN',      // Chinese - China
        'ja': 'ja-JP',      // Japanese - Japan
        'ko': 'ko-KR',      // Korean - Korea
        'hr': 'hr-HR',      // Croatian - Croatia
        'sk': 'sk-SK',      // Slovak - Slovakia
        'pl': 'pl-PL',      // Polish - Poland
        'el': 'el-GR',      // Greek - Greece
      };

      const murfTargetLang = languageMap[targetLanguage];

      if (!murfTargetLang) {
        throw new Error(`Unsupported target language: ${targetLanguage}`);
      }

      console.log(`🌐 Batch translating ${texts.length} texts to ${targetLanguage} (${murfTargetLang})`);

      const response = await axios.post(
        `${this.baseURL}/text/translate`,
        {
          texts: texts,
          targetLanguage: murfTargetLang
          // Note: sourceLanguage is not needed - Murf auto-detects
        },
        {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      if (response.data && response.data.translations && Array.isArray(response.data.translations)) {
        const translatedTexts = response.data.translations.map(item => item.translated_text);
        console.log(`✅ Batch translation successful: ${translatedTexts.length} texts translated`);
        return translatedTexts;
      } else {
        throw new Error('Invalid response from Murf API');
      }

    } catch (error) {
      console.error('Batch translation error:', error);
      
      if (error.response) {
        console.error('API Error Response:', error.response.data);
        throw new Error(`Translation API error: ${error.response.data.errorMessage || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Translation service unavailable');
      } else {
        throw new Error(`Translation failed: ${error.message}`);
      }
    }
  }

  /**
   * Get supported languages
   * @returns {Array} Array of supported languages
   */
  getSupportedLanguages() {
    return [
      { code: 'en', name: 'English', flag: '🇺🇸', speechCode: 'en-US' },
      { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', speechCode: 'hi-IN' },
      { code: 'bn', name: 'বাংলা', flag: '🇧🇩', speechCode: 'bn-IN' },
      { code: 'ta', name: 'தமிழ்', flag: '🇮🇳', speechCode: 'ta-IN' },
      { code: 'es', name: 'Español', flag: '🇪🇸', speechCode: 'es-ES' },
      { code: 'fr', name: 'Français', flag: '🇫🇷', speechCode: 'fr-FR' },
      { code: 'de', name: 'Deutsch', flag: '🇩🇪', speechCode: 'de-DE' },
      { code: 'it', name: 'Italiano', flag: '🇮🇹', speechCode: 'it-IT' },
      { code: 'nl', name: 'Nederlands', flag: '🇳🇱', speechCode: 'nl-NL' },
      { code: 'pt', name: 'Português', flag: '🇧🇷', speechCode: 'pt-BR' },
      { code: 'zh', name: '中文', flag: '🇨🇳', speechCode: 'zh-CN' },
      { code: 'ja', name: '日本語', flag: '🇯🇵', speechCode: 'ja-JP' },
      { code: 'ko', name: '한국어', flag: '🇰🇷', speechCode: 'ko-KR' },
      { code: 'hr', name: 'Hrvatski', flag: '🇭🇷', speechCode: 'hr-HR' },
      { code: 'sk', name: 'Slovenčina', flag: '🇸🇰', speechCode: 'sk-SK' },
      { code: 'pl', name: 'Polski', flag: '🇵🇱', speechCode: 'pl-PL' },
      { code: 'el', name: 'Ελληνικά', flag: '🇬🇷', speechCode: 'el-GR' },
    ];
  }
}

module.exports = TranslationService; 