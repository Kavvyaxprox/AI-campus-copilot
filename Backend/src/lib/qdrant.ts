import { QdrantClient } from '@qdrant/js-client-rest';
import type { Schemas } from '@qdrant/js-client-rest';
import { env } from '../config/env';

export const qdrant = new QdrantClient({
  url: env.qdrantUrl,
  apiKey: env.qdrantApiKey,
});

export const COLLECTION = env.qdrantCollection;

export type PayloadFilter = Schemas['Filter'];

/**
 * The REST client returns either a boolean or `{ exists: boolean }` depending
 * on the installed version, so normalise both shapes.
 */
async function collectionPresent(): Promise<boolean> {
  const result = (await qdrant.collectionExists(COLLECTION)) as
    | boolean
    | { exists?: boolean };
  return typeof result === 'boolean' ? result : Boolean(result?.exists);
}

export async function ensureCollection(): Promise<void> {
  const exists = await collectionPresent();
  if (!exists) {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: env.embeddingDimension, distance: 'Cosine' },
      on_disk_payload: true,
    });
    console.log(`[qdrant] created collection "${COLLECTION}"`);
  }

  const indexFields = ['status', 'departmentId', 'documentId', 'semester'];
  for (const field of indexFields) {
    try {
      await qdrant.createPayloadIndex(COLLECTION, {
        field_name: field,
        field_schema: field === 'semester' ? 'integer' : 'keyword',
        wait: false,
      });
    } catch {
      // index may already exist, Qdrant returns an error we can safely ignore
    }
  }
}

export async function upsertVectors(
  points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }>,
): Promise<void> {
  if (points.length === 0) return;
  const batchSize = 64;
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    await qdrant.upsert(COLLECTION, { wait: true, points: batch });
  }
}

export async function markPayloadByDocument(
  documentId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await qdrant.setPayload(COLLECTION, {
    wait: true,
    payload,
    filter: { must: [{ key: 'documentId', match: { value: documentId } }] },
  });
}
