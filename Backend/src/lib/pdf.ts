import pdf from 'pdf-parse';

export interface ExtractedPdf {
  pages: string[];
  pageCount: number;
  totalCharacters: number;
}

/**
 * Extracts PDF text page by page using pdf-parse's custom page renderer so
 * every vector chunk keeps an exact page number for citations.
 */
export async function extractPdfPages(buffer: Buffer): Promise<ExtractedPdf> {
  const pages: string[] = [];

  const data = await pdf(buffer, {
    pagerender: (pageData: any) => {
      return pageData.getTextContent().then((content: any) => {
        let text = '';
        let previousY: number | null = null;

        for (const item of content.items) {
          if (typeof item.str !== 'string') continue;
          const y = Array.isArray(item.transform) ? Number(item.transform[5]) : null;
          const newline =
            previousY !== null && y !== null && !Number.isNaN(y) && Math.abs(y - previousY) > 2;
          if (newline) {
            text += '\n';
          } else if (text.length > 0 && !text.endsWith(' ') && item.str.trim() !== '') {
            text += ' ';
          }
          text += item.str;
          if (y !== null && !Number.isNaN(y)) previousY = y;
        }

        pages.push(text.replace(/[ \t]+\n/g, '\n').trim());
        return text;
      });
    },
  });

  const cleaned = pages.map((page) => page.trim());
  const totalCharacters = cleaned.reduce((sum, page) => sum + page.length, 0);

  return {
    pages: cleaned,
    pageCount: data.numpages || cleaned.length,
    totalCharacters,
  };
}
