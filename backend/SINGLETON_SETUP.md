# Singleton Prisma Client Setup

This document explains the singleton Prisma client implementation and backend configuration for the Lyra chatbot platform.

## Changes Made

### 1. Singleton Prisma Client

Created `src/lib/prisma.js` with a singleton pattern:
- Single PrismaClient instance shared across the application
- Proper connection management and graceful shutdown
- Development logging configuration

### 2. Updated All Route Files

Updated the following files to use the singleton Prisma client:
- `src/routes/auth.js`
- `src/routes/projects.js` 
- `src/routes/chat.js`
- `src/services/aiService.js`

### 3. Backend Configuration

- **Port**: Backend runs on `localhost:3001`
- **API Base URL**: `http://localhost:3001/api`
- **CORS**: Configured for frontend on `localhost:5173`
- **Environment Variables**: Updated with proper configuration

## File Structure

```
backend/
├── src/
│   ├── lib/
│   │   └── prisma.js          # Singleton Prisma client
│   ├── routes/
│   │   ├── auth.js            # Updated to use singleton
│   │   ├── projects.js        # Updated to use singleton
│   │   └── chat.js            # Updated to use singleton
│   ├── services/
│   │   └── aiService.js       # Updated to use singleton
│   └── index.js               # Main server file
├── test-prisma.js             # Prisma connection test
├── test-embeddings.js         # Embedding API test
└── env.example                # Updated environment variables
```

## Environment Variables

Required environment variables in `.env`:

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://username:password@ep-xxx-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# Google AI
GOOGLE_API_KEY="your-google-api-key"

# Murf AI
MURF_API_KEY="your-murf-api-key"

# Server
PORT=3001
NODE_ENV=development

# File Upload
MAX_FILE_SIZE=10485760 # 10MB in bytes
UPLOAD_PATH="./uploads"

# Frontend URL (for CORS)
FRONTEND_URL="http://localhost:5173"
```

## Testing

### Test Prisma Connection
```bash
npm run test:prisma
```

### Test Embeddings
```bash
npm run test:embeddings
```

### Start Development Server
```bash
npm run dev
```

## Benefits of Singleton Pattern

1. **Connection Pooling**: Single connection pool for better performance
2. **Memory Efficiency**: Prevents multiple PrismaClient instances
3. **Resource Management**: Proper connection cleanup on shutdown
4. **Consistency**: Same client instance across all modules
5. **Error Handling**: Centralized connection error handling

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get user profile

### Projects
- `GET /api/projects` - Get user projects
- `POST /api/projects` - Create new project with PDF
- `GET /api/projects/:id` - Get specific project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Chat
- `POST /api/chat/:projectId` - Send text message
- `POST /api/chat/:projectId/voice` - Send voice message

## Frontend Integration

The frontend is configured to connect to:
- **Base URL**: `http://localhost:3001/api`
- **CORS**: Enabled for `localhost:5173`
- **Authentication**: JWT token in Authorization header

## Next Steps

1. Set up your Neon PostgreSQL database
2. Add your Google API key to `.env`
3. Run `npm run test:prisma` to verify database connection
4. Run `npm run test:embeddings` to verify Google AI integration
5. Start the development server with `npm run dev` 