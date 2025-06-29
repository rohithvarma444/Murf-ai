require('dotenv').config();
const { generateEmbedding } = require('./src/services/aiService');

async function testEmbeddings() {
  try {
    console.log('Testing Google Gemini Embedding API...');
    
    // Test text
    const testText = "This is a test sentence for embedding generation.";
    
    console.log('Generating embedding for:', testText);
    
    // Generate embedding
    const embedding = await generateEmbedding(testText);
    
    console.log('✅ Embedding generated successfully!');
    console.log('Embedding dimensions:', embedding.length);
    console.log('First 5 values:', embedding.slice(0, 5));
    console.log('Last 5 values:', embedding.slice(-5));
    
    // Test with another sentence
    const testText2 = "This is a different sentence to test embedding similarity.";
    const embedding2 = await generateEmbedding(testText2);
    
    console.log('\n✅ Second embedding generated successfully!');
    console.log('Second embedding dimensions:', embedding2.length);
    
    // Test cosine similarity
    const { cosineSimilarity } = require('./src/services/aiService');
    const similarity = cosineSimilarity(embedding, embedding2);
    console.log('\n📊 Cosine similarity between embeddings:', similarity.toFixed(4));
    
    console.log('\n🎉 All tests passed! Google Gemini embedding integration is working correctly.');
    
  } catch (error) {
    console.error('❌ Error testing embeddings:', error.message);
    console.error('Make sure your GOOGLE_API_KEY is set correctly in your .env file');
  }
}

// Run the test
testEmbeddings(); 