require('dotenv').config();
const prisma = require('./src/lib/prisma');

async function testPrismaConnection() {
  try {
    console.log('Testing Prisma singleton connection...');
    
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const userCount = await prisma.user.count();
    console.log(`📊 Total users in database: ${userCount}`);
    
    // Test project count
    const projectCount = await prisma.project.count();
    console.log(`📊 Total projects in database: ${projectCount}`);
    
    // Test document count
    const documentCount = await prisma.document.count();
    console.log(`📊 Total documents in database: ${documentCount}`);
    
    console.log('\n🎉 Prisma singleton is working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing Prisma connection:', error.message);
    console.error('Make sure your DATABASE_URL is set correctly in your .env file');
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPrismaConnection(); 