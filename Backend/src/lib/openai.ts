import OpenAI from 'openai';
import { env, hasOpenAiKey } from '../config/env';
import { serviceUnavailable } from './http';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!hasOpenAiKey()) {
    throw serviceUnavailable(
      'OPENAI_API_KEY is not configured on the server, so embeddings and answers cannot be generated. Add the key to Backend/.env and restart the API.',
    );
  }
  if (!client) {
    client = new OpenAI({ apiKey: env.openaiApiKey });
  }
  return client;
}

export const EMBEDDING_BATCH_SIZE = 64;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const openai = getClient();
  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: env.embeddingModel,
      input: batch,
    });
    const ordered = [...response.data].sort((a, b) => a.index - b.index);
    for (const item of ordered) vectors.push(item.embedding);
  }

  return vectors;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}

export async function createChatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const openai = getClient();
  const response = await openai.chat.completions.create({
    model: env.chatModel,
    messages,
    temperature: 0.1,
    max_tokens: 900,
  });
  return response.choices[0]?.message?.content?.trim() ?? '';
}
