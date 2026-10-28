/** Formatos de resposta que um bloco sabe ler; espelham `PageSourceKind` no backend. */
export type SourceKind = 'list' | 'count' | 'series';

export interface ListResponse {
  data?: Record<string, unknown>[];
  meta?: { total?: number; page?: number; limit?: number; totalPages?: number };
}

export interface SeriesResponse {
  data?: { date: string; value: number }[];
}

export type SourceData = ListResponse | SeriesResponse;
