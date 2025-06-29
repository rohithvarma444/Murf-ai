# Neon PostgreSQL Setup Guide

This guide will help you set up Neon PostgreSQL for the Lyra AI chatbot platform.

## 1. Create a Neon Account

1. Go to [neon.tech](https://neon.tech)
2. Sign up for a free account
3. Create a new project

## 2. Get Your Connection String

1. In your Neon dashboard, go to your project
2. Click on "Connection Details"
3. Copy the connection string that looks like:
   ```
   postgresql://username:password@ep-xxx-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

## 3. Configure Environment Variables

1. Copy `env.example` to `.env`:
   ```bash
   cp env.example .env
   ```

2. Update the `DATABASE_URL` in your `.env` file with your Neon connection string:
   ```env
   DATABASE_URL="postgresql://username:password@ep-xxx-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require"
   ```

## 4. Set Up the Database

1. Install dependencies:
   ```bash
   npm install
   ```

2. Generate Prisma client:
   ```bash
   npm run db:generate
   ```

3. Push the schema to Neon:
   ```bash
   npm run db:push
   ```

## 5. Verify Setup

1. Open Prisma Studio to verify the database:
   ```bash
   npm run db:studio
   ```

2. You should see all the tables created in your Neon database.

## Important Notes

- **No pgvector extension needed**: This setup uses JSON arrays to store embeddings and calculates similarity in JavaScript
- **Performance**: For production with large datasets, consider using a vector database like Pinecone or Weaviate
- **Backup**: Neon provides automatic backups, but you can also export your data
- **Scaling**: Neon automatically scales based on your usage

## Troubleshooting

- **Connection issues**: Make sure your connection string includes `?sslmode=require`
- **Schema push fails**: Check that your Neon project is active and the connection string is correct
- **Performance**: If you have many embeddings, consider implementing pagination in the similarity search

## Next Steps

1. Set up your Google AI API keys
2. Configure Murf AI for voice features
3. Test the application with a sample PDF 