/**
 * Semantic Search Stub
 * Provides document search and indexing for FitMind.
 */

export interface SearchResult {
  documentId: string;
  chunk: string;
  text: string;
  score: number;
}

class SemanticSearch {
  async search(
    _query: string,
    _opts?: {
      documentId?: string;
      limit?: number;
      topK?: number;
      minScore?: number;
      documentFilter?: string | string[];
    },
  ): Promise<SearchResult[]> {
    return [];
  }

  async indexDocument(_documentId: string, _content: string, _chunkSize?: number, _overlap?: number): Promise<number> {
    return 0;
  }
}

export const semanticSearch = new SemanticSearch();
