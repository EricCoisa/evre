/** Marcação que libera um endpoint para ser fonte de dados de um bloco do PageBuilder. */
export const PAGE_SOURCE_KEY = 'PAGE_SOURCE';

/** Formato da resposta do endpoint: `list`, `count` ou `series`. */
export type PageSourceKind = 'list' | 'count' | 'series';

/** Shape que todo endpoint `kind: 'series'` devolve. */
export interface SeriesPoint {
  date: string;
  value: number;
}
export interface SeriesResponse {
  data: SeriesPoint[];
}

export interface PageSourceMeta {
  key: string;
  kind: PageSourceKind;
  /** Lido pelo agente para escolher a fonte. Diga o que o dado É, não como buscá-lo. */
  description: string;
  /** Campos do item que podem virar coluna de tabela. Obrigatório em `list`. */
  fields?: string[];
  /** Parâmetros de query que o bloco pode mandar, com nome e tipo declarados. */
  params?: PageSourceParam[];
}

export interface PageSourceParam {
  name: string;
  type: 'number' | 'string' | 'boolean';
  /** Limites e semântica em texto — é o que o modelo lê antes de escolher um valor. */
  description: string;
}

/** O que o registry devolve: a marcação + o RBAC do próprio endpoint. */
export interface PageSourceEntry extends PageSourceMeta {
  roles: string[];
}
