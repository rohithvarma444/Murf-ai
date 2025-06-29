const { GoogleGenerativeAI } = require('@google/generative-ai');
const TranslationService = require('./translationService');

// Use singleton instance
const translationService = new TranslationService();

class AIService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * Process chat message with complete translation flow
   * @param {string} projectId - Project ID
   * @param {string} message - User message
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<Object>} Chat response with translation
   */
  async processChatMessage(projectId, message, targetLanguage = 'en') {
    try {
      console.log(`🤖 Processing chat message for project ${projectId}`);
      console.log(`📝 Original message: "${message}"`);
      console.log(`🌐 Target language: ${targetLanguage}`);

      // Step 1: Detect input language
      console.log(`🔍 Step 1: Detecting language for: "${message}"`);
      const detectedLanguage = await translationService.detectLanguage(message);
      console.log(`🔍 Detected language: ${detectedLanguage}`);

      let englishMessage = message;
      let originalMessage = message;

      // Step 2: Translate to English if not already English
      if (detectedLanguage !== 'en') {
        console.log(`🌐 Step 2: Translating from ${detectedLanguage} to English`);
        console.log(`📝 Original text: "${message}"`);
        englishMessage = await translationService.translateText(message, 'en');
        console.log(`✅ Translated to English: "${englishMessage}"`);
      } else {
        console.log(`✅ Step 2: Already in English, no translation needed`);
      }

      // Step 3: Get relevant context from PDF embeddings using English text
      console.log(`🔍 Step 3: Searching embeddings with English text: "${englishMessage}"`);
      const PDFProcessor = require('./pdfProcessor');
      const pdfProcessor = new PDFProcessor();
      const relevantChunks = await pdfProcessor.searchContent(englishMessage, projectId, 5);
      
      console.log(`📚 Found ${relevantChunks.length} relevant chunks`);
      
      if (relevantChunks.length === 0) {
        console.log(`⚠️ No relevant context found, using fallback response`);
        const noContextResponse = "I don't have enough information to answer that question. Please ask something related to the uploaded document.";
        const translatedResponse = await this.translateResponse(noContextResponse, targetLanguage);
        
        return {
          response: translatedResponse,
          context: [],
          language: targetLanguage,
          originalMessage: originalMessage,
          englishMessage: englishMessage
        };
      }

      // Step 4: Build context from relevant chunks
      const context = relevantChunks
        .map(chunk => chunk.chunk)
        .join('\n\n');

      console.log(`📚 Step 4: Built context from ${relevantChunks.length} chunks`);

      // Step 5: Generate response using Gemini with English text
      console.log(`🤖 Step 5: Generating response with English question: "${englishMessage}"`);
      const prompt = this.buildPrompt(context, englishMessage);
      const englishResponse = await this.generateContent(prompt);
      console.log(`🤖 English response: "${englishResponse}"`);

      // Step 6: Translate response to target language if needed
      console.log(`🌐 Step 6: Translating response to ${targetLanguage}`);
      const finalResponse = await this.translateResponse(englishResponse, targetLanguage);
      console.log(`🌐 Final response in ${targetLanguage}: "${finalResponse}"`);

      return {
        response: finalResponse,
        context: relevantChunks.map(chunk => ({
          text: chunk.chunk,
          similarity: chunk.similarity,
          metadata: chunk.metadata
        })),
        language: targetLanguage,
        originalMessage: originalMessage,
        englishMessage: englishMessage,
        englishResponse: englishResponse
      };

    } catch (error) {
      console.error('❌ Error processing chat message:', error);
      throw new Error(`Chat processing failed: ${error.message}`);
    }
  }

  /**
   * Build prompt for Gemini
   * @param {string} context - Relevant context from PDF
   * @param {string} message - User message
   * @returns {string} Formatted prompt
   */
  buildPrompt(context, message) {
    return `You are an intelligent AI assistant that helps users understand documents. Use the following context from a PDF document to answer the user's question accurately and helpfully.

Context from the document:
${context}

User Question: ${message}

Instructions:
- Answer based only on the provided context
- Be helpful, accurate, and concise
- If the context doesn't contain enough information, say so clearly
- Provide specific details from the document when possible
- Keep responses under 500 words
- Write in clear, professional English

Answer:`;
  }

  /**
   * Generate content using Gemini
   * @param {string} prompt - Formatted prompt
   * @returns {Promise<string>} Generated response
   */
  async generateContent(prompt) {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating response:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  /**
   * Translate response to target language
   * @param {string} response - English response
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<string>} Translated response
   */
  async translateResponse(response, targetLanguage) {
    try {
      if (targetLanguage === 'en') {
        return response;
      }

      console.log(`🌐 Translating response to ${targetLanguage}`);
      const translatedResponse = await translationService.translateText(response, targetLanguage, 'en');
      console.log(`✅ Response translated successfully`);
      return translatedResponse;
    } catch (error) {
      console.error('Translation error, returning English response:', error);
      return response; // Fallback to English
    }
  }

  /**
   * Generate response for general chat (without project documents)
   * @param {string} message - User message
   * @param {Array} documents - Project documents (empty for general chat)
   * @param {string} language - Target language
   * @returns {Promise<Object>} Chat response
   */
  async generateResponse(message, documents = [], language = 'en') {
    try {
      console.log(`🤖 Generating response for message: "${message}" in language: ${language}`);

      // Detect input language
      console.log(`🔍 Step 1: Detecting language for: "${message}"`);
      const detectedLanguage = await translationService.detectLanguage(message);
      console.log(`🔍 Detected language: ${detectedLanguage}`);

      let englishMessage = message;
      let originalMessage = message;

      // Translate to English if not already English
      if (detectedLanguage !== 'en') {
        console.log(`🌐 Step 2: Translating from ${detectedLanguage} to English`);
        console.log(`📝 Original text: "${message}"`);
        englishMessage = await translationService.translateText(message, 'en');
        console.log(`✅ Translated to English: "${englishMessage}"`);
      } else {
        console.log(`✅ Step 2: Already in English, no translation needed`);
      }

      // Build prompt for general chat
      console.log(`🤖 Step 3: Generating response with English question: "${englishMessage}"`);
      const prompt = this.buildGeneralPrompt(englishMessage);
      const englishResponse = await this.generateContent(prompt);
      console.log(`🤖 English response: "${englishResponse}"`);

      // Step 5: Translate response back to target language if needed
      let finalResponse;
      if (language !== 'en') {
        console.log(`🌐 Step 5: Translating response to ${language}`);
        console.log(`📝 English response: "${englishResponse}"`);
        finalResponse = await translationService.translateText(englishResponse, language);
        console.log(`✅ Final response in ${language}: "${finalResponse}"`);
      } else {
        console.log(`✅ Step 5: Response already in English`);
        finalResponse = englishResponse;
      }

      return {
        response: finalResponse,
        context: [],
        language: language,
        originalMessage: originalMessage,
        englishMessage: englishMessage,
        englishResponse: englishResponse
      };

    } catch (error) {
      console.error('❌ Error generating response:', error);
      throw new Error(`Response generation failed: ${error.message}`);
    }
  }

  /**
   * Build prompt for general chat (without specific document context)
   * @param {string} message - User message
   * @returns {string} Formatted prompt
   */
  buildGeneralPrompt(message) {
    return `You are an intelligent AI assistant powered by Google Gemini. Answer the user's question helpfully and accurately.

User Question: ${message}

Instructions:
- Provide helpful, accurate, and informative responses
- Be conversational and friendly
- Keep responses concise but comprehensive
- If you're not sure about something, say so clearly
- Write in clear, professional English
- Be helpful for general knowledge questions

Answer:`;
  }

  /**
   * Get supported languages for the chat interface
   * @returns {Array} Array of supported languages
   */
  getSupportedLanguages() {
    return [
      { code: 'en', name: 'English', flag: '🇺🇸' },
      { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
      { code: 'bn', name: 'বাংলা', flag: '🇧🇩' },
      { code: 'ta', name: 'தமிழ்', flag: '🇮🇳' },
      { code: 'es', name: 'Español', flag: '🇪🇸' },
      { code: 'fr', name: 'Français', flag: '🇫🇷' },
      { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
      { code: 'it', name: 'Italiano', flag: '🇮🇹' },
      { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
      { code: 'pt', name: 'Português', flag: '🇧🇷' },
      { code: 'zh', name: '中文', flag: '🇨🇳' },
      { code: 'ja', name: '日本語', flag: '🇯🇵' },
      { code: 'ko', name: '한국어', flag: '🇰🇷' },
      { code: 'hr', name: 'Hrvatski', flag: '🇭🇷' },
      { code: 'sk', name: 'Slovenčina', flag: '🇸🇰' },
      { code: 'pl', name: 'Polski', flag: '🇵🇱' },
      { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
    ];
  }
}

module.exports = new AIService(); 