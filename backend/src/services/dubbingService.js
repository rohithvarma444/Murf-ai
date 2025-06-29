const axios = require('axios');
const fs = require('fs');
const path = require('path');

class DubbingService {
  constructor() {
    // Murf uses a separate API key for its Dubbing Automation API.
    // Prefer MURF_DUB_API_KEY if provided, otherwise fall back to MURF_API_KEY.
    this.apiKey = process.env.MURF_DUB_API_KEY || process.env.MURF_API_KEY;
    // Corrected base URL according to Murf Dub Automation API docs
    this.baseURL = 'https://api.murf.ai/v1/murfdub';
    
    console.log('🎬 Dubbing Service initialized');
    console.log('🔑 MURF_API_KEY:', this.apiKey ? 'Set' : 'Not set');
  }

  /**
   * Create a dubbing job for video/audio content
   * @param {Object} options - Dubbing options
   * @param {string} options.fileName - Name for the file
   * @param {Buffer|string} options.file - File buffer or file path
   * @param {string} options.fileUrl - URL to the file (alternative to file)
   * @param {Array<string>} options.targetLocales - Target languages (e.g., ['fr_FR', 'es_ES'])
   * @param {string} options.priority - Priority level ('LOW', 'NORMAL', 'HIGH')
   * @param {string} options.webhookUrl - Webhook URL for notifications
   * @param {string} options.webhookSecret - Webhook secret for validation
   * @returns {Promise<Object>} Dubbing job response
   */
  async createDubbingJob(options) {
    try {
      if (!this.apiKey) {
        throw new Error('MURF_API_KEY not configured');
      }

      const {
        fileName,
        file,
        fileUrl,
        targetLocales = ['en_US'],
        priority = 'LOW',
        webhookUrl,
        webhookSecret
      } = options;

      if (!fileName) {
        throw new Error('fileName is required');
      }

      if (!file && !fileUrl) {
        throw new Error('Either file or fileUrl must be provided');
      }

      if (!targetLocales || targetLocales.length === 0) {
        throw new Error('At least one target locale must be specified');
      }

      console.log(`🎬 Creating dubbing job for: ${fileName}`);
      console.log(`🌐 Target locales: ${targetLocales.join(', ')}`);
      console.log(`⚡ Priority: ${priority}`);

      // Prepare request data
      const requestData = {
        file_name: fileName,
        target_locales: targetLocales,
        priority: priority
      };

      if (webhookUrl) {
        requestData.webhook_url = webhookUrl;
      }

      if (webhookSecret) {
        requestData.webhook_secret = webhookSecret;
      }

      let response;

      if (fileUrl) {
        // Use file URL
        requestData.file_url = fileUrl;
        console.log(`📄 Using file URL: ${fileUrl}`);

        response = await axios.post(
          `${this.baseURL}/jobs/create`,
          requestData,
          {
            headers: {
              'api-key': this.apiKey,
              'Content-Type': 'application/json'
            },
            timeout: 60000
          }
        );
      } else {
        // Use file upload
        console.log(`📄 Uploading file: ${fileName}`);
        
        const FormData = require('form-data');
        const formData = new FormData();
        
        // Add file
        if (Buffer.isBuffer(file)) {
          formData.append('file', file, fileName);
        } else if (typeof file === 'string') {
          // File path
          formData.append('file', fs.createReadStream(file), fileName);
        } else {
          throw new Error('Invalid file format. Expected Buffer or file path.');
        }

        // Add other fields
        Object.keys(requestData).forEach(key => {
          if (Array.isArray(requestData[key])) {
            requestData[key].forEach(value => {
              formData.append(key, value);
            });
          } else {
            formData.append(key, requestData[key]);
          }
        });

        response = await axios.post(
          `${this.baseURL}/jobs/create`,
          formData,
          {
            headers: {
              'api-key': this.apiKey,
              ...formData.getHeaders()
            },
            timeout: 120000 // Longer timeout for file uploads
          }
        );
      }

      console.log('✅ Dubbing job created successfully');
      console.log(`🆔 Job ID: ${response.data.job_id}`);

      return {
        success: true,
        jobId: response.data.job_id,
        dubbingType: response.data.dubbing_type,
        fileName: response.data.file_name,
        priority: response.data.priority,
        targetLocales: response.data.target_locales,
        sourceLocale: response.data.source_locale,
        fileUrl: response.data.file_url,
        webhookUrl: response.data.webhook_url,
        warning: response.data.warning,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Dubbing job creation failed:', error);
      
      if (error.response) {
        const errorData = error.response.data;
        throw new Error(`Dubbing API error: ${errorData.errorMessage || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Dubbing service unavailable');
      } else {
        throw new Error(`Dubbing job creation failed: ${error.message}`);
      }
    }
  }

  /**
   * Get status of a dubbing job
   * @param {string} jobId - Dubbing job ID
   * @returns {Promise<Object>} Job status and download details
   */
  async getDubbingJobStatus(jobId) {
    try {
      if (!this.apiKey) {
        throw new Error('MURF_API_KEY not configured');
      }

      if (!jobId) {
        throw new Error('jobId is required');
      }

      console.log(`🔍 Checking status for dubbing job: ${jobId}`);

      const response = await axios.get(
        `${this.baseURL}/jobs/${jobId}/status`,
        {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const data = response.data;
      console.log(`📊 Job ${jobId} status: ${data.status}`);

      return {
        success: true,
        jobId: data.job_id,
        status: data.status,
        projectId: data.project_id,
        downloadDetails: data.download_details,
        creditsUsed: data.credits_used,
        creditsRemaining: data.credits_remaining,
        failureReason: data.failure_reason,
        failureCode: data.failure_code,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Failed to get dubbing job status for ${jobId}:`, error);
      
      if (error.response) {
        const errorData = error.response.data;
        throw new Error(`Dubbing API error: ${errorData.errorMessage || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Dubbing service unavailable');
      } else {
        throw new Error(`Failed to get job status: ${error.message}`);
      }
    }
  }

  /**
   * Create dubbing job with project ID for editable/persistent dubs
   * @param {Object} options - Dubbing options with project management
   * @returns {Promise<Object>} Dubbing job response with project ID
   */
  async createPersistentDubbingJob(options) {
    try {
      if (!this.apiKey) {
        throw new Error('MURF_API_KEY not configured');
      }

      const {
        fileName,
        file,
        fileUrl,
        targetLocales = ['en_US'],
        priority = 'LOW',
        webhookUrl,
        webhookSecret,
        projectName
      } = options;

      console.log(`🎬 Creating persistent dubbing job for: ${fileName}`);
      console.log(`📁 Project name: ${projectName || 'Default Project'}`);

      // Prepare request data
      const requestData = {
        file_name: fileName,
        target_locales: targetLocales,
        priority: priority,
        project_name: projectName || fileName
      };

      if (webhookUrl) {
        requestData.webhook_url = webhookUrl;
      }

      if (webhookSecret) {
        requestData.webhook_secret = webhookSecret;
      }

      let response;

      if (fileUrl) {
        requestData.file_url = fileUrl;
        response = await axios.post(
          `${this.baseURL}/jobs/create-with-project-id`,
          requestData,
          {
            headers: {
              'api-key': this.apiKey,
              'Content-Type': 'application/json'
            },
            timeout: 60000
          }
        );
      } else {
        const FormData = require('form-data');
        const formData = new FormData();
        
        if (Buffer.isBuffer(file)) {
          formData.append('file', file, fileName);
        } else if (typeof file === 'string') {
          formData.append('file', fs.createReadStream(file), fileName);
        } else {
          throw new Error('Invalid file format. Expected Buffer or file path.');
        }

        Object.keys(requestData).forEach(key => {
          if (Array.isArray(requestData[key])) {
            requestData[key].forEach(value => {
              formData.append(key, value);
            });
          } else {
            formData.append(key, requestData[key]);
          }
        });

        response = await axios.post(
          `${this.baseURL}/jobs/create-with-project-id`,
          formData,
          {
            headers: {
              'api-key': this.apiKey,
              ...formData.getHeaders()
            },
            timeout: 120000
          }
        );
      }

      console.log('✅ Persistent dubbing job created successfully');
      console.log(`🆔 Job ID: ${response.data.job_id}`);
      console.log(`📁 Project ID: ${response.data.project_id}`);

      return {
        success: true,
        jobId: response.data.job_id,
        projectId: response.data.project_id,
        dubbingType: response.data.dubbing_type,
        fileName: response.data.file_name,
        priority: response.data.priority,
        targetLocales: response.data.target_locales,
        sourceLocale: response.data.source_locale,
        fileUrl: response.data.file_url,
        webhookUrl: response.data.webhook_url,
        warning: response.data.warning,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Persistent dubbing job creation failed:', error);
      
      if (error.response) {
        const errorData = error.response.data;
        throw new Error(`Dubbing API error: ${errorData.errorMessage || error.response.statusText}`);
      } else {
        throw new Error(`Persistent dubbing job creation failed: ${error.message}`);
      }
    }
  }

  /**
   * Download dubbed content
   * @param {string} downloadUrl - Download URL from job status
   * @param {string} outputPath - Local path to save the file
   * @returns {Promise<string>} Path to downloaded file
   */
  async downloadDubbedContent(downloadUrl, outputPath) {
    try {
      if (!downloadUrl) {
        throw new Error('downloadUrl is required');
      }

      console.log(`⬇️ Downloading dubbed content from: ${downloadUrl}`);

      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
        timeout: 300000 // 5 minutes for large files
      });

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Stream download to file
      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`✅ Downloaded dubbed content to: ${outputPath}`);
          resolve(outputPath);
        });
        writer.on('error', reject);
      });

    } catch (error) {
      console.error('❌ Failed to download dubbed content:', error);
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  /**
   * Get supported source languages
   * @returns {Array<string>} Array of supported source language codes
   */
  getSupportedSourceLanguages() {
    return [
      'auto_detect',
      'en_US', 'en_UK', 'en_IN', 'en_SCOTT', 'en_AU',
      'fr_FR', 'de_DE', 'es_ES', 'es_MX', 'it_IT',
      'pt_BR', 'pl_PL', 'hi_IN', 'ko_KR', 'ja_JP',
      'zh_CN', 'nl_NL', 'fi_FI', 'ru_RU', 'tr_TR', 'uk_UA'
    ];
  }

  /**
   * Get supported destination languages
   * @returns {Array<string>} Array of supported destination language codes
   */
  getSupportedDestinationLanguages() {
    return [
      'en_US', 'en_UK', 'en_IN', 'en_SCOTT', 'en_AU',
      'fr_FR', 'de_DE', 'es_ES', 'es_MX', 'it_IT',
      'pt_BR', 'pl_PL', 'hi_IN', 'ko_KR', 'ta_IN',
      'bn_IN', 'ja_JP', 'zh_CN', 'nl_NL', 'fi_FI',
      'ru_RU', 'tr_TR', 'uk_UA', 'da_DK', 'id_ID',
      'ro_RO', 'nb_NO'
    ];
  }

  /**
   * Get language name from code
   * @param {string} languageCode - Language code
   * @returns {string} Human-readable language name
   */
  getLanguageName(languageCode) {
    const languageMap = {
      'en_US': 'English (US & Canada)',
      'en_UK': 'English (UK)',
      'en_IN': 'English (India)',
      'en_SCOTT': 'English (Scotland)',
      'en_AU': 'English (Australia)',
      'fr_FR': 'French',
      'de_DE': 'German',
      'es_ES': 'Spanish (Spain)',
      'es_MX': 'Spanish (Mexico)',
      'it_IT': 'Italian',
      'pt_BR': 'Portuguese (Brazil)',
      'pl_PL': 'Polish',
      'hi_IN': 'Hindi',
      'ko_KR': 'Korean',
      'ta_IN': 'Tamil',
      'bn_IN': 'Bengali',
      'ja_JP': 'Japanese',
      'zh_CN': 'Mandarin (Chinese)',
      'nl_NL': 'Dutch',
      'fi_FI': 'Finnish',
      'ru_RU': 'Russian',
      'tr_TR': 'Turkish',
      'uk_UA': 'Ukrainian',
      'da_DK': 'Danish',
      'id_ID': 'Indonesian',
      'ro_RO': 'Romanian',
      'nb_NO': 'Norwegian'
    };

    return languageMap[languageCode] || languageCode;
  }

  /**
   * Validate language codes
   * @param {Array<string>} targetLocales - Target language codes
   * @returns {Object} Validation result
   */
  validateLanguages(targetLocales) {
    const supportedLanguages = this.getSupportedDestinationLanguages();
    const unsupportedLanguages = targetLocales.filter(lang => !supportedLanguages.includes(lang));
    
    return {
      isValid: unsupportedLanguages.length === 0,
      unsupportedLanguages,
      supportedLanguages: targetLocales.filter(lang => supportedLanguages.includes(lang))
    };
  }

  /**
   * Estimate dubbing cost (placeholder - actual costs depend on Murf pricing)
   * @param {number} durationMinutes - Video/audio duration in minutes
   * @param {number} languageCount - Number of target languages
   * @returns {Object} Cost estimation
   */
  estimateCost(durationMinutes, languageCount) {
    const baseCreditsPerMinute = 100; // Placeholder value
    const totalCredits = Math.ceil(durationMinutes * baseCreditsPerMinute * languageCount);
    
    return {
      estimatedCredits: totalCredits,
      durationMinutes,
      languageCount,
      creditsPerMinute: baseCreditsPerMinute,
      note: 'Actual costs may vary based on Murf pricing and content complexity'
    };
  }
}

module.exports = DubbingService; 