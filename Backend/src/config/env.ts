import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
dotenv.config();

function read(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('Missing required environment variable: JWT_SECRET');
}

export const env = {
  nodeEnv: read('NODE_ENV', 'development'),
  port: Number(read('PORT', '4000')),
  jwtSecret,
  jwtExpiresIn: read('JWT_EXPIRES_IN', '12h'),
  qdrantUrl: read('QDRANT_URL', 'http://localhost:6333'),
  qdrantApiKey: process.env.QDRANT_API_KEY || undefined,
  qdrantCollection: read('QDRANT_COLLECTION', 'campus_knowledge'),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  embeddingModel: read('EMBEDDING_MODEL', 'text-embedding-3-small'),
  chatModel: read('CHAT_MODEL', 'gpt-4o-mini'),
  corsOrigin: read('CORS_ORIGIN', 'http://localhost:5173'),
  uploadsDir: path.resolve(__dirname, '..', '..', 'uploads'),
  embeddingDimension: 1536,
} as const;

export function hasOpenAiKey(): boolean {
  return env.openaiApiKey.length > 0;
}
