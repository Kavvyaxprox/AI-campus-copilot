export interface TextChunk {
  text: string;
  page: number;
  index: number;
  tokenEstimate: number;
}

const DEFAULT_CHUNK_TOKENS = 400;
const DEFAULT_OVERLAP_TOKENS = 60;

/** Rough token estimate: ~4 characters per token for English body text. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Splits a single page of text into overlapping chunks of roughly
 * `chunkTokens` tokens with `overlapTokens` of context carried over between
 * consecutive chunks so no sentence boundary is lost.
 */
export function chunkText(
  text: string,
  page: number,
  chunkTokens = DEFAULT_CHUNK_TOKENS,
  overlapTokens = DEFAULT_OVERLAP_TOKENS,
): TextChunk[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: TextChunk[] = [];
  const overlapChars = overlapTokens * 4;
  let current: string[] = [];
  let currentText = '';

  const push = () => {
    const value = currentText.trim();
    if (!value) return;
    chunks.push({
      text: value,
      page,
      index: chunks.length,
      tokenEstimate: estimateTokens(value),
    });
  };

  for (const word of words) {
    const candidate = currentText ? `${currentText} ${word}` : word;
    if (estimateTokens(candidate) > chunkTokens && currentText) {
      push();

      const tail = currentText.slice(Math.max(0, currentText.length - overlapChars));
      const tailWords = tail.split(/\s+/).filter(Boolean);
      current = tailWords;
      currentText = tailWords.join(' ');
      continue;
    }
    current = [...current, word];
    currentText = candidate;
  }

  push();
  return chunks;
}

/** Chunks every page while keeping the original 1-based page number. */
export function chunkPages(pages: string[]): TextChunk[] {
  const result: TextChunk[] = [];
  pages.forEach((pageText, pageIndex) => {
    const pageNumber = pageIndex + 1;
    for (const chunk of chunkText(pageText, pageNumber)) {
      result.push({ ...chunk, index: result.length });
    }
  });
  return result;
}
