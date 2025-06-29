class EmotionService {
  constructor() {
    // Emotion keywords and their intensity scores
    this.emotionKeywords = {
      joy: {
        keywords: ['happy', 'joy', 'excited', 'wonderful', 'amazing', 'fantastic', 'great', 'excellent', 'delighted', 'thrilled', 'ecstatic', 'elated', 'cheerful', 'jubilant', 'euphoric'],
        intensity: 0.8
      },
      sadness: {
        keywords: ['sad', 'depressed', 'miserable', 'unhappy', 'sorrowful', 'melancholy', 'gloomy', 'heartbroken', 'devastated', 'despair', 'hopeless', 'dejected'],
        intensity: 0.7
      },
      anger: {
        keywords: ['angry', 'furious', 'enraged', 'irritated', 'annoyed', 'frustrated', 'outraged', 'livid', 'incensed', 'fuming', 'mad', 'hostile', 'aggressive'],
        intensity: 0.8
      },
      fear: {
        keywords: ['afraid', 'scared', 'terrified', 'frightened', 'anxious', 'worried', 'nervous', 'panicked', 'horrified', 'dread', 'apprehensive', 'fearful'],
        intensity: 0.7
      },
      surprise: {
        keywords: ['surprised', 'shocked', 'astonished', 'amazed', 'stunned', 'bewildered', 'startled', 'dumbfounded', 'flabbergasted', 'incredible', 'unbelievable'],
        intensity: 0.6
      },
      disgust: {
        keywords: ['disgusted', 'revolted', 'repulsed', 'sickened', 'nauseated', 'appalled', 'horrified', 'offended', 'disturbed', 'gross', 'vile'],
        intensity: 0.6
      },
      trust: {
        keywords: ['trust', 'confident', 'reliable', 'secure', 'safe', 'trustworthy', 'faithful', 'loyal', 'dependable', 'assured', 'certain'],
        intensity: 0.5
      },
      anticipation: {
        keywords: ['excited', 'eager', 'looking forward', 'anticipate', 'expect', 'hope', 'optimistic', 'enthusiastic', 'keen', 'ready'],
        intensity: 0.6
      },
      neutral: {
        keywords: ['okay', 'fine', 'normal', 'usual', 'standard', 'regular', 'typical', 'average', 'moderate', 'balanced'],
        intensity: 0.3
      }
    };

    // Language-specific emotion keywords
    this.languageEmotions = {
      hi: {
        joy: ['खुश', 'आनंद', 'प्रसन्न', 'उत्साहित', 'मज़ेदार', 'शानदार', 'बहुत अच्छा'],
        sadness: ['दुखी', 'उदास', 'निराश', 'दुख', 'दर्द', 'अफसोस', 'खेद'],
        anger: ['गुस्सा', 'क्रोध', 'नाराज', 'चिढ़', 'क्रोधित', 'आक्रोश'],
        fear: ['डर', 'भय', 'चिंता', 'आशंका', 'भयभीत', 'घबराहट'],
        surprise: ['आश्चर्य', 'हैरान', 'चौंक', 'अचरज', 'विस्मय'],
        trust: ['विश्वास', 'भरोसा', 'आत्मविश्वास', 'सुरक्षित'],
        neutral: ['ठीक', 'सामान्य', 'साधारण', 'मध्यम']
      },
      bn: {
        joy: ['সুখী', 'আনন্দিত', 'উত্তেজিত', 'মজার', 'দারুণ', 'চমৎকার'],
        sadness: ['দুঃখী', 'বিষণ্ণ', 'নিরাশ', 'দুঃখ', 'ব্যথা', 'খেদ'],
        anger: ['রাগ', 'ক্রোধ', 'নাখোশ', 'বিরক্ত', 'ক্রুদ্ধ'],
        fear: ['ভয়', 'আশঙ্কা', 'চিন্তা', 'ভীত', 'আতঙ্ক'],
        surprise: ['বিস্ময়', 'হতবাক', 'চমক', 'আশ্চর্য'],
        trust: ['বিশ্বাস', 'আত্মবিশ্বাস', 'নিরাপদ'],
        neutral: ['ঠিক', 'সাধারণ', 'মাঝারি']
      },
      ta: {
        joy: ['மகிழ்ச்சி', 'சந்தோஷம்', 'ஆர்வம்', 'சிறந்த', 'அருமை', 'நன்று'],
        sadness: ['வருத்தம்', 'சோகம்', 'நம்பிக்கையற்ற', 'துக்கம்', 'வேதனை'],
        anger: ['கோபம்', 'சினம்', 'எரிச்சல்', 'கோபமாக', 'வெறுப்பு'],
        fear: ['பயம்', 'அச்சம்', 'கவலை', 'பயந்த', 'பதட்டம்'],
        surprise: ['ஆச்சரியம்', 'திகைப்பு', 'வியப்பு', 'அதிர்ச்சி'],
        trust: ['நம்பிக்கை', 'நம்புதல்', 'பாதுகாப்பு'],
        neutral: ['சரி', 'சாதாரண', 'மிதமான']
      }
    };
  }

  /**
   * Detect emotion in text
   * @param {string} text - Text to analyze
   * @param {string} language - Language code
   * @returns {Object} Emotion analysis result
   */
  detectEmotion(text, language = 'en') {
    try {
      if (!text || !text.trim()) {
        return {
          primaryEmotion: 'neutral',
          confidence: 1.0,
          emotions: { neutral: 1.0 },
          wordMapping: []
        };
      }

      const words = text.toLowerCase().split(/\s+/);
      const emotionScores = {};
      const wordMapping = [];

      // Initialize emotion scores
      Object.keys(this.emotionKeywords).forEach(emotion => {
        emotionScores[emotion] = 0;
      });

      // Check each word for emotions
      words.forEach((word, index) => {
        const cleanWord = word.replace(/[^\w]/g, '');
        if (!cleanWord) return;

        let wordEmotion = 'neutral';
        let maxScore = 0;

        // Check English emotions
        Object.entries(this.emotionKeywords).forEach(([emotion, data]) => {
          if (data.keywords.some(keyword => cleanWord.includes(keyword) || keyword.includes(cleanWord))) {
            const score = data.intensity;
            emotionScores[emotion] += score;
            if (score > maxScore) {
              maxScore = score;
              wordEmotion = emotion;
            }
          }
        });

        // Check language-specific emotions
        if (this.languageEmotions[language]) {
          Object.entries(this.languageEmotions[language]).forEach(([emotion, keywords]) => {
            if (keywords.some(keyword => cleanWord.includes(keyword) || keyword.includes(cleanWord))) {
              const score = this.emotionKeywords[emotion]?.intensity || 0.5;
              emotionScores[emotion] += score;
              if (score > maxScore) {
                maxScore = score;
                wordEmotion = emotion;
              }
            }
          });
        }

        // Add word mapping
        wordMapping.push({
          word: word,
          index: index,
          emotion: wordEmotion,
          confidence: maxScore
        });
      });

      // Find primary emotion
      let primaryEmotion = 'neutral';
      let maxScore = 0;

      Object.entries(emotionScores).forEach(([emotion, score]) => {
        if (score > maxScore) {
          maxScore = score;
          primaryEmotion = emotion;
        }
      });

      // Calculate confidence
      const totalScore = Object.values(emotionScores).reduce((sum, score) => sum + score, 0);
      const confidence = totalScore > 0 ? maxScore / totalScore : 1.0;

      // Normalize emotion scores
      const normalizedEmotions = {};
      Object.entries(emotionScores).forEach(([emotion, score]) => {
        normalizedEmotions[emotion] = totalScore > 0 ? score / totalScore : 0;
      });

      return {
        primaryEmotion,
        confidence,
        emotions: normalizedEmotions,
        wordMapping
      };

    } catch (error) {
      console.error('Emotion detection error:', error);
      return {
        primaryEmotion: 'neutral',
        confidence: 1.0,
        emotions: { neutral: 1.0 },
        wordMapping: []
      };
    }
  }

  /**
   * Get emotion color for UI
   * @param {string} emotion - Emotion name
   * @returns {string} CSS color
   */
  getEmotionColor(emotion) {
    const emotionColors = {
      joy: '#FFD700',      // Gold
      sadness: '#4682B4',  // Steel Blue
      anger: '#DC143C',    // Crimson
      fear: '#8B4513',     // Saddle Brown
      surprise: '#FF69B4', // Hot Pink
      disgust: '#228B22',  // Forest Green
      trust: '#4169E1',    // Royal Blue
      anticipation: '#FF8C00', // Dark Orange
      neutral: '#808080'   // Gray
    };

    return emotionColors[emotion] || '#808080';
  }

  /**
   * Get emotion icon for UI
   * @param {string} emotion - Emotion name
   * @returns {string} Icon name
   */
  getEmotionIcon(emotion) {
    const emotionIcons = {
      joy: '😊',
      sadness: '😢',
      anger: '😠',
      fear: '😨',
      surprise: '😲',
      disgust: '🤢',
      trust: '🤝',
      anticipation: '🤗',
      neutral: '😐'
    };

    return emotionIcons[emotion] || '😐';
  }

  /**
   * Get emotion description
   * @param {string} emotion - Emotion name
   * @returns {string} Description
   */
  getEmotionDescription(emotion) {
    const descriptions = {
      joy: 'Happy and positive',
      sadness: 'Sad or melancholic',
      anger: 'Angry or frustrated',
      fear: 'Scared or anxious',
      surprise: 'Surprised or shocked',
      disgust: 'Disgusted or repulsed',
      trust: 'Trusting or confident',
      anticipation: 'Excited or eager',
      neutral: 'Neutral or calm'
    };

    return descriptions[emotion] || 'Neutral';
  }
}

module.exports = EmotionService; 