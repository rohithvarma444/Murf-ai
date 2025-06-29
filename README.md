# Lyra AI - Multilingual Voice-Enabled Chatbot Platform

A modern SaaS platform that transforms PDF documents into intelligent, multilingual, voice-powered chatbots using Gemini AI, Google Embeddings, and Murf AI.

## Features

- **Company Portal**: Secure authentication, PDF upload, automatic content extraction
- **Customer Chat Portal**: Public-facing chat with voice/text input in multiple languages
- **AI Integration**: Gemini AI, Google Embeddings, Murf AI for TTS/STT
- **Vector Database**: PostgreSQL with pgvector for efficient similarity search

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL with pgvector extension
- **AI Services**: Google Gemini, Google Embeddings, Murf AI
- **Authentication**: JWT with bcrypt

## Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd lyra
   npm run install:all
   ```

2. **Set up environment variables:**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your database and API credentials
   ```

3. **Set up the database:**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Start development servers:**
   ```bash
   npm run dev
   ```

5. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Prisma Studio: http://localhost:5555

## Environment Variables

Create a `.env` file in the backend directory:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/lyra_db"

# JWT
JWT_SECRET="your-super-secret-jwt-key"

# Google AI
GOOGLE_API_KEY="your-google-api-key"
GOOGLE_PROJECT_ID="your-google-project-id"

# Murf AI
MURF_API_KEY="your-murf-api-key"

# Server
PORT=3001
NODE_ENV=development
```

## Project Structure

```
lyra/
├── frontend/          # React frontend application
├── backend/           # Node.js backend with Prisma
├── package.json       # Root package.json for scripts
└── README.md         # This file
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Projects
- `POST /api/projects` - Create new project with PDF
- `GET /api/projects` - Get user's projects
- `GET /api/projects/:id` - Get project details
- `DELETE /api/projects/:id` - Delete project

### Chat
- `POST /api/chat/:projectId` - Send message to chatbot
- `POST /api/chat/:projectId/voice` - Send voice message

## Database Schema

The application uses Prisma with PostgreSQL and includes:
- User management
- Project storage
- Document embeddings
- Chat history
- Vector similarity search

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License 