/**
 * Integration probe for the retrieval filter used by POST /api/chat.
 * Run with: npx tsx probe-filter.ts
 */
import { randomUUID } from 'node:crypto';
import { COLLECTION, ensureCollection, qdrant, upsertVectors } from './src/lib/qdrant';
import { buildRetrievalFilter } from './src/services/rag';

const DIMENSION = 1536;
const PROBE_DOCUMENT_ID = `filter-probe-${randomUUID()}`;
const CSE = 'dept-cse-probe';
const ECE = 'dept-ece-probe';

const vector = (seed: number) =>
  Array.from({ length: DIMENSION }, (_, i) => Math.sin(seed * 100 + i * 0.37) * 0.5);

interface ProbePoint {
  label: string;
  departmentId: string | null;
  status: 'PUBLISHED' | 'SUPERSEDED';
}

const PROBE_POINTS: ProbePoint[] = [
  { label: 'cse doc', departmentId: CSE, status: 'PUBLISHED' },
  { label: 'ece doc', departmentId: ECE, status: 'PUBLISHED' },
  { label: 'global doc', departmentId: null, status: 'PUBLISHED' },
  { label: 'cse superseded', departmentId: CSE, status: 'SUPERSEDED' },
  { label: 'cse doc 2', departmentId: CSE, status: 'PUBLISHED' },
];

async function cleanup(): Promise<void> {
  await qdrant
    .delete(COLLECTION, {
      wait: true,
      filter: { must: [{ key: 'documentId', match: { value: PROBE_DOCUMENT_ID } }] },
    })
    .catch(() => undefined);
}

async function main(): Promise<void> {
  await ensureCollection();
  await cleanup();

  await upsertVectors(
    PROBE_POINTS.map((point, index) => ({
      id: randomUUID(),
      vector: vector(index + 1),
      payload: {
        documentId: PROBE_DOCUMENT_ID,
        chunkId: `${PROBE_DOCUMENT_ID}:${index}`,
        title: 'Filter probe',
        category: 'Administration',
        text: point.label,
        page: index + 1,
        departmentId: point.departmentId,
        semester: null,
        version: 1,
        status: point.status,
      },
    })),
  );

  const filter = buildRetrievalFilter(CSE);
  const response = await qdrant.query(COLLECTION, {
    query: { nearest: vector(1) },
    filter,
    limit: 10,
    with_payload: true,
  });

  const hits = (response.points ?? []).map(
    (point) => String((point.payload as { text?: string })?.text ?? '?'),
  );
  console.log('retrieval filter:', JSON.stringify(filter));
  console.log('hits for CSE student:', JSON.stringify(hits));

  const expected = ['cse doc', 'cse doc 2', 'global doc'];
  const forbidden = ['ece doc', 'cse superseded'];
  const ok =
    expected.every((label) => hits.includes(label)) &&
    forbidden.every((label) => !hits.includes(label));

  console.log(ok ? 'FILTER OK: scope and status enforced' : 'FILTER FAILED');
  await cleanup();
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
