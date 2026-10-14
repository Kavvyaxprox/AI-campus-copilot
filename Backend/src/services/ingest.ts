import { randomUUID } from 'node:crypto';
import { upsertVectors } from '../lib/qdrant';
import { embedTexts } from '../lib/openai';
import { chunkPages } from '../lib/chunk';

export interface IngestInput {
  documentId: string;
  title: string;
  category: string;
  departmentId: string | null;
  semester: number | null;
  version: number;
  pages: string[];
}

export interface IngestResult {
  chunkCount: number;
  pageCount: number;
  skippedPages: number;
}

/**
 * Chunks every extracted page, generates embeddings with
 * text-embedding-3-small and upserts the vectors into Qdrant with the
 * metadata payload used for pre-retrieval RBAC filtering.
 */
export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const allChunks = chunkPages(input.pages);
  const chunks = allChunks.filter((chunk) => chunk.text.length >= 40);
  const skippedPages = allChunks.length - chunks.length;

  if (chunks.length === 0) {
    throw new Error('No extractable text was found in the uploaded PDF.');
  }

  const vectors = await embedTexts(chunks.map((chunk) => chunk.text));

  const points = chunks.map((chunk, position) => ({
    id: randomUUID(),
    vector: vectors[position],
    payload: {
      documentId: input.documentId,
      chunkId: `${input.documentId}:${chunk.page}:${chunk.index}`,
      title: input.title,
      category: input.category,
      text: chunk.text,
      page: chunk.page,
      departmentId: input.departmentId,
      semester: input.semester,
      version: input.version,
      status: 'PUBLISHED',
    },
  }));

  await upsertVectors(points);

  return {
    chunkCount: points.length,
    pageCount: input.pages.length,
    skippedPages,
  };
}
