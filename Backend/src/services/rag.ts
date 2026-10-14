import type { Schemas } from '@qdrant/js-client-rest';
import { embedQuery } from '../lib/openai';
import { COLLECTION, PayloadFilter, qdrant } from '../lib/qdrant';

export const RETRIEVAL_LIMIT = 6;

export interface RetrievedChunk {
  score: number;
  documentId: string;
  chunkId: string;
  title: string;
  category: string;
  text: string;
  page: number;
  version: number;
  departmentId: string | null;
  semester: number | null;
}

/**
 * Pre-retrieval access filter.
 *
 *   status == 'PUBLISHED'
 *   AND (departmentId == <student department> OR departmentId IS NULL)
 *
 * Department null means an institution-wide document, visible to every role.
 * The filter is applied inside Qdrant, so a student can never receive a
 * vector belonging to another department or a superseded document.
 */
export function buildRetrievalFilter(departmentId: string | null): PayloadFilter {
  const departmentBranches: Schemas['Condition'][] = [
    { is_null: { key: 'departmentId' } },
  ];

  if (departmentId) {
    departmentBranches.unshift({ key: 'departmentId', match: { value: departmentId } });
  }

  return {
    must: [
      { key: 'status', match: { value: 'PUBLISHED' } },
      { should: departmentBranches },
    ],
  };
}

function readPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export async function retrieveKnowledge(
  query: string,
  options: { departmentId: string | null; limit?: number },
): Promise<RetrievedChunk[]> {
  const vector = await embedQuery(query);
  const filter = buildRetrievalFilter(options.departmentId);

  const response = await qdrant.query(COLLECTION, {
    query: { nearest: vector },
    filter,
    limit: options.limit ?? RETRIEVAL_LIMIT,
    with_payload: true,
  });

  const points = (response as Schemas['QueryResponse']).points ?? [];

  return points.map((point) => {
    const payload = readPayload(point.payload);
    return {
      score: Number(point.score ?? 0),
      documentId: readString(payload.documentId),
      chunkId: readString(payload.chunkId),
      title: readString(payload.title, 'Untitled document'),
      category: readString(payload.category, 'General'),
      text: readString(payload.text),
      page: readNumber(payload.page, 1),
      version: readNumber(payload.version, 1),
      departmentId: readNullableString(payload.departmentId),
      semester: typeof payload.semester === 'number' ? payload.semester : null,
    };
  });
}

export interface SourceCitation {
  ref: number;
  documentId: string;
  title: string;
  category: string;
  page: number;
  version: number;
}

export function buildContextBlock(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, index) => {
      const ref = index + 1;
      const department = chunk.departmentId ?? 'Institution-wide';
      return `[${ref}] ${chunk.title} | category=${chunk.category} | version=${chunk.version} | page=${chunk.page} | scope=${department}\n${chunk.text}`;
    })
    .join('\n\n---\n\n');
}

export function collectCitations(answer: string, chunks: RetrievedChunk[]): SourceCitation[] {
  const seen = new Set<number>();
  const citations: SourceCitation[] = [];

  for (const match of answer.matchAll(/\[(\d{1,2})\]/g)) {
    const ref = Number(match[1]);
    if (!Number.isInteger(ref) || ref < 1 || ref > chunks.length) continue;
    if (seen.has(ref)) continue;
    seen.add(ref);

    const chunk = chunks[ref - 1];
    citations.push({
      ref,
      documentId: chunk.documentId,
      title: chunk.title,
      category: chunk.category,
      page: chunk.page,
      version: chunk.version,
    });
  }

  return citations;
}
