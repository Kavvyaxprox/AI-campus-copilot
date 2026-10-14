import fs from 'node:fs';
import { createApp } from './app';
import { env, hasOpenAiKey } from './config/env';
import { ensureCollection } from './lib/qdrant';

async function main(): Promise<void> {
  fs.mkdirSync(env.uploadsDir, { recursive: true });

  try {
    await ensureCollection();
  } catch (error) {
    console.warn(
      `[startup] Qdrant is not reachable at ${env.qdrantUrl}: ${(error as Error).message}`,
    );
    console.warn('[startup] Document ingestion and chat will fail until Qdrant is running.');
  }

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`AI Campus Copilot API listening on http://localhost:${env.port}`);
    console.log(`  CORS origin : ${env.corsOrigin}`);
    console.log(`  Qdrant      : ${env.qdrantUrl} (${env.qdrantCollection})`);
    console.log(`  Embeddings  : ${env.embeddingModel}`);
    console.log(`  Chat model  : ${env.chatModel}`);
    if (!hasOpenAiKey()) {
      console.warn('  OPENAI_API_KEY is empty: set it in Backend/.env to enable RAG.');
    }
  });
}

main().catch((error) => {
  console.error('Failed to start the API:', error);
  process.exit(1);
});
