# Google Gemini AI Integration Setup

This guide explains how to set up and use Google Gemini AI for embeddings and text generation in the Lyra chatbot platform.

## Prerequisites

1. **Google Cloud Account**: You need a Google Cloud account
2. **Google AI Studio API Key**: Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

## Setup Instructions

### 1. Get Your Google API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Configure Environment Variables

Add your Google API key to your `.env` file:

```env
# Google AI
GOOGLE_API_KEY="your-google-api-key-here"
```

### 3. Test the Integration

Run the embedding test to verify everything is working:

```bash
npm run test:embeddings
```

You should see output like:
```
Testing Google Gemini Embedding API...
Generating embedding for: This is a test sentence for embedding generation.
✅ Embedding generated successfully!
Embedding dimensions: 768
First 5 values: [0.123, -0.456, 0.789, -0.012, 0.345]
Last 5 values: [0.234, -0.567, 0.890, -0.123, 0.456]

✅ Second embedding generated successfully!
Second embedding dimensions: 768

📊 Cosine similarity between embeddings: 0.8234

🎉 All tests passed! Google Gemini embedding integration is working correctly.
```

## Features

### Embedding Generation
- Uses Google's `embedding-gecko-001` model
- Generates 768-dimensional embeddings
- Optimized for semantic similarity search

### Text Generation
- Uses Google's `gemini-pro` model
- Context-aware responses based on document content
- Multi-language support

### Vector Similarity Search
- Cosine similarity calculation for finding relevant document chunks
- Efficient context retrieval for chatbot responses

## API Usage

### Generate Embeddings
```javascript
const { generateEmbedding } = require('./src/services/aiService');

const embedding = await generateEmbedding("Your text here");
console.log(embedding.length); // 768
```

### Generate AI Responses
```javascript
const { generateGeminiResponse } = require('./src/services/aiService');

const response = await generateGeminiResponse(
  "What is the main topic?", 
  "Context from your documents...",
  "en"
);
```

### Process Chat Messages
```javascript
const { processChatMessage } = require('./src/services/aiService');

const result = await processChatMessage(
  "User question", 
  "project-id", 
  "en", 
  false
);
```

## Troubleshooting

### Common Issues

1. **"Failed to generate embedding"**
   - Check your `GOOGLE_API_KEY` is correct
   - Verify you have sufficient API quota
   - Ensure your Google Cloud project is enabled for AI APIs

2. **"API key not found"**
   - Make sure your `.env` file is in the backend directory
   - Restart your server after adding the API key

3. **Rate limiting errors**
   - Google AI has rate limits per minute/hour
   - Implement retry logic for production use

### Rate Limits

- **Embedding API**: 1000 requests per minute
- **Text Generation**: 60 requests per minute
- **Free tier**: Limited requests per day

## Production Considerations

1. **API Key Security**: Never commit API keys to version control
2. **Rate Limiting**: Implement proper rate limiting and retry logic
3. **Error Handling**: Add comprehensive error handling for API failures
4. **Monitoring**: Monitor API usage and costs
5. **Caching**: Consider caching embeddings for frequently accessed documents

## Cost Optimization

- Google AI pricing is based on input/output tokens
- Embeddings are relatively inexpensive (~$0.0001 per 1K tokens)
- Text generation costs more (~$0.0015 per 1K input tokens)
- Monitor usage in Google Cloud Console

## Next Steps

1. Test the integration with your PDF documents
2. Implement proper error handling and retry logic
3. Add monitoring and logging for production use
4. Consider implementing embedding caching for better performance 