const { PDFLoader } = require('langchain/document_loaders/fs/pdf');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

class PDFProcessor {
  constructor() {
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      modelName: 'embedding-001',
      apiKey: process.env.GOOGLE_API_KEY,
    });
    
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', ' ', ''],
    });
  }

  /**
   * Process PDF file with atomic operations
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @param {Object} projectData - Project metadata
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Created project with document
   */
  async processPDFAtomically(pdfBuffer, projectData, userId) {
    let tempFilePath = null;
    let project = null;
    let document = null;

    try {
      // Step 1: Save PDF to temporary file
      tempFilePath = await this.savePDFToTemp(pdfBuffer);
      
      // Step 2: Load and parse PDF using LangChain
      const documents = await this.loadPDF(tempFilePath);
      
      // Step 3: Split text into chunks
      const chunks = await this.splitText(documents);
      
      // Step 4: Generate embeddings for all chunks
      const embeddings = await this.generateEmbeddings(chunks);
      
      // Step 5: Validate all embeddings were generated
      if (embeddings.length !== chunks.length) {
        throw new Error(`Embedding mismatch: ${embeddings.length} embeddings for ${chunks.length} chunks`);
      }

      // Step 6: Create project and document in database (atomic transaction)
      const result = await prisma.$transaction(async (tx) => {
        // Create project
        const newProject = await tx.project.create({
          data: {
            name: projectData.name,
            description: projectData.description || '',
            userId: userId,
            isActive: true,
          },
        });

        // Create document
        const newDocument = await tx.document.create({
          data: {
            filename: projectData.filename,
            fileSize: pdfBuffer.length,
            content: documents.map(doc => doc.pageContent).join('\n\n'),
            projectId: newProject.id,
          },
        });

        // Create embeddings
        const embeddingRecords = chunks.map((chunk, index) => ({
          documentId: newDocument.id,
          chunk: chunk.pageContent,
          embedding: embeddings[index],
          metadata: {
            chunkIndex: index,
            chunkSize: chunk.pageContent.length,
            pageNumber: chunk.metadata.pageNumber || 1,
            source: chunk.metadata.source || projectData.filename,
          },
        }));

        await tx.embedding.createMany({
          data: embeddingRecords,
        });

        return { project: newProject, document: newDocument };
      });

      project = result.project;
      document = result.document;

      console.log(`✅ PDF processed successfully: ${chunks.length} chunks embedded for project ${project.id}`);

      return {
        project,
        document,
        stats: {
          totalChunks: chunks.length,
          totalPages: documents.length,
          fileSize: pdfBuffer.length,
        },
      };

    } catch (error) {
      console.error('❌ PDF processing failed:', error);
      
      // Clean up any created resources
      if (project) {
        try {
          await prisma.project.delete({ where: { id: project.id } });
        } catch (cleanupError) {
          console.error('Failed to cleanup project:', cleanupError);
        }
      }
      
      throw error;
    } finally {
      // Clean up temporary file
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          console.error('Failed to cleanup temp file:', cleanupError);
        }
      }
    }
  }

  /**
   * Save PDF buffer to temporary file
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @returns {Promise<string>} Temporary file path
   */
  async savePDFToTemp(pdfBuffer) {
    const tempDir = path.join(__dirname, '../../temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempFileName = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.pdf`;
    const tempFilePath = path.join(tempDir, tempFileName);
    
    await fs.writeFile(tempFilePath, pdfBuffer);
    return tempFilePath;
  }

  /**
   * Load PDF using LangChain PDFLoader
   * @param {string} filePath - Path to PDF file
   * @returns {Promise<Array>} Array of document objects
   */
  async loadPDF(filePath) {
    try {
      const loader = new PDFLoader(filePath, {
        splitPages: true,
      });
      
      const documents = await loader.load();
      
      if (!documents || documents.length === 0) {
        throw new Error('No content extracted from PDF');
      }

      console.log(`📄 Loaded ${documents.length} pages from PDF`);
      return documents;
    } catch (error) {
      console.error('Error loading PDF:', error);
      throw new Error(`Failed to load PDF: ${error.message}`);
    }
  }

  /**
   * Split documents into chunks
   * @param {Array} documents - Array of document objects
   * @returns {Promise<Array>} Array of text chunks
   */
  async splitText(documents) {
    try {
      const chunks = await this.textSplitter.splitDocuments(documents);
      
      // Filter out very short chunks
      const validChunks = chunks.filter(chunk => 
        chunk.pageContent.trim().length > 50
      );

      console.log(`✂️ Split into ${validChunks.length} chunks (filtered from ${chunks.length})`);
      return validChunks;
    } catch (error) {
      console.error('Error splitting text:', error);
      throw new Error(`Failed to split text: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for text chunks
   * @param {Array} chunks - Array of text chunks
   * @returns {Promise<Array>} Array of embedding vectors
   */
  async generateEmbeddings(chunks) {
    try {
      console.log(`🔗 Generating embeddings for ${chunks.length} chunks...`);
      
      const texts = chunks.map(chunk => chunk.pageContent);
      const embeddings = await this.embeddings.embedDocuments(texts);
      
      console.log(`✅ Generated ${embeddings.length} embeddings`);
      return embeddings;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }

  /**
   * Get project statistics
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Project statistics
   */
  async getProjectStats(projectId) {
    try {
      const [project, document, embeddingCount] = await Promise.all([
        prisma.project.findUnique({
          where: { id: projectId },
          include: {
            _count: {
              select: { chatSessions: true }
            }
          }
        }),
        prisma.document.findFirst({
          where: { projectId },
          select: { id: true, filename: true, fileSize: true }
        }),
        prisma.embedding.count({
          where: {
            document: { projectId }
          }
        })
      ]);

      return {
        project,
        document,
        stats: {
          totalEmbeddings: embeddingCount,
          totalChatSessions: project?._count.chatSessions || 0,
        }
      };
    } catch (error) {
      console.error('Error getting project stats:', error);
      throw error;
    }
  }

  /**
   * Search for relevant content using embeddings
   * @param {string} query - Search query
   * @param {string} projectId - Project ID
   * @param {number} limit - Number of results to return
   * @returns {Promise<Array>} Array of relevant chunks
   */
  async searchContent(query, projectId, limit = 5) {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.embeddings.embedQuery(query);
      
      // Get all embeddings for the project
      const embeddings = await prisma.embedding.findMany({
        where: {
          document: { projectId }
        },
        include: {
          document: true
        }
      });

      // Calculate cosine similarities
      const similarities = embeddings.map(embedding => ({
        chunk: embedding.chunk,
        similarity: this.cosineSimilarity(queryEmbedding, embedding.embedding),
        metadata: embedding.metadata
      }));

      // Sort by similarity and return top results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      console.error('Error searching content:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {Array} vecA - First vector
   * @param {Array} vecB - Second vector
   * @returns {number} Cosine similarity score
   */
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

module.exports = PDFProcessor; 