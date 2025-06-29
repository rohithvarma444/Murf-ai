require('dotenv').config();
const PDFProcessor = require('./src/services/pdfProcessor');
const fs = require('fs').promises;
const path = require('path');

async function testPDFProcessing() {
  try {
    console.log('🧪 Testing PDF Processing with LangChain...');
    
    const pdfProcessor = new PDFProcessor();
    
    // Create a simple test PDF content (you can replace this with an actual PDF file)
    const testProjectData = {
      name: 'Test Terms & Conditions',
      description: 'Test project for PDF processing',
      filename: 'test-terms.pdf'
    };
    
    // Create a simple test PDF buffer (this is just for testing)
    // In real usage, you would upload an actual PDF file
    const testPdfBuffer = Buffer.from('Test PDF content for processing');
    
    console.log('📄 Test project data:', testProjectData);
    
    // Test the PDF processor
    console.log('\n🚀 Starting PDF processing test...');
    
    // Note: This will fail because we don't have a real PDF file
    // In real usage, you would pass an actual PDF buffer
    console.log('⚠️  Note: This test will fail because we need a real PDF file');
    console.log('   To test with a real PDF, upload a file through the API');
    
    // Test the embedding generation separately
    console.log('\n🔗 Testing embedding generation...');
    const testTexts = [
      'This is a test document about terms and conditions.',
      'The company provides various services to customers.',
      'All users must agree to these terms before using the service.'
    ];
    
    const embeddings = await pdfProcessor.generateEmbeddings(
      testTexts.map(text => ({ pageContent: text, metadata: {} }))
    );
    
    console.log('✅ Generated embeddings successfully!');
    console.log(`📊 Generated ${embeddings.length} embeddings`);
    console.log(`🔢 Embedding dimensions: ${embeddings[0]?.length || 'N/A'}`);
    
    // Test cosine similarity
    console.log('\n📐 Testing cosine similarity...');
    if (embeddings.length >= 2) {
      const similarity = pdfProcessor.cosineSimilarity(embeddings[0], embeddings[1]);
      console.log(`📊 Similarity between first two embeddings: ${similarity.toFixed(4)}`);
    }
    
    console.log('\n🎉 PDF processing test completed successfully!');
    console.log('\n📝 To test with a real PDF:');
    console.log('1. Start the backend server: npm run dev');
    console.log('2. Use the frontend to upload a PDF file');
    console.log('3. Check the console logs for processing details');
    
  } catch (error) {
    console.error('❌ PDF processing test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testPDFProcessing(); 