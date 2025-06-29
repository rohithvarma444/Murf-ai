#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up environment variables for Lyra Customer Care...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, 'env.example');

if (!fs.existsSync(envExamplePath)) {
  console.error('❌ env.example file not found!');
  process.exit(1);
}

if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists. Backing up to .env.backup');
  fs.copyFileSync(envPath, path.join(__dirname, '.env.backup'));
}

// Copy env.example to .env
fs.copyFileSync(envExamplePath, envPath);
console.log('✅ Created .env file from env.example');

// Read the .env file
let envContent = fs.readFileSync(envPath, 'utf8');

// Add helpful comments
const additionalComments = `

# ========================================
# CUSTOMER CARE CONFIGURATION
# ========================================
# 
# MAX_TTS_CONNECTIONS: Controls the maximum number of concurrent
# WebSocket connections to the Murf TTS API. If you're experiencing
# "Exceeded Active context limit" errors, try reducing this value.
# 
# Recommended values:
# - Development: 5-10
# - Production: 10-20 (depending on your Murf plan)
# - If you have a free Murf account: 3-5
#
# ========================================
`;

envContent += additionalComments;

// Write back to .env
fs.writeFileSync(envPath, envContent);

console.log('\n📝 Please edit the .env file and configure the following:');
console.log('  1. DATABASE_URL - Your Neon PostgreSQL connection string');
console.log('  2. JWT_SECRET - A secure random string for JWT tokens');
console.log('  3. GOOGLE_API_KEY - Your Google AI API key');
console.log('  4. MURF_API_KEY - Your Murf AI API key');
console.log('  5. MAX_TTS_CONNECTIONS - Connection limit (default: 10)');
console.log('\n💡 If you experience "Exceeded Active context limit" errors:');
console.log('   - Reduce MAX_TTS_CONNECTIONS to 5 or lower');
console.log('   - Check your Murf AI plan limits');
console.log('   - Consider upgrading your Murf plan for more connections');
console.log('\n🚀 After configuring, run: npm start'); 