export interface LayoutProfile {
  /** Tipos de bloco que este profile oferece — espelha o `profiles` de cada entrada de `BLOCK_META`. */
  blocks: readonly string[];
  /** `role-filtered` confere a fonte contra o alcance de quem grava; `none` recusa qualquer `data.source`. */
  dataSources: 'role-filtered' | 'none';
  /** `config` guarda o layout em User/SystemConfiguration; `record` em registro próprio (sem `pageKey` de catálogo). */
  storage: 'config' | 'record';
  maxBlocks: number;
  maxChildren: number;
}

/** Superfícies que o PageBuilder monta. Cada profile decide blocos, fonte de dado, persistência e tetos. */
export const LAYOUT_PROFILES = {
  dashboard: {
    blocks: [
      'group',
      'chart.area',
      'chart.bar',
      'chart.line',
      'alert.banner',
      'text.rich',
      'button.action',
      'list.feed',
      'table.basic',
    ],
    dataSources: 'role-filtered',
    storage: 'config',
    maxBlocks: 20,
    maxChildren: 12,
  },
  proposal: {
    blocks: [
      'group',
      'text.rich',
      'button.action',
      'alert.banner',
      'topic',
      'image',
      'investment',
      'iframe',
    ],
    dataSources: 'none',
    storage: 'record',
    maxBlocks: 80,
    maxChildren: 12,
  },
} as const satisfies Record<string, LayoutProfile>;

export type LayoutProfileName = keyof typeof LAYOUT_PROFILES;

/** Profile de quem não declara nada — a superfície que existia antes de haver profile. */
export const DEFAULT_PROFILE = 'dashboard' satisfies LayoutProfileName;

export function isLayoutProfileName(value: unknown): value is LayoutProfileName {
  return typeof value === 'string' && value in LAYOUT_PROFILES;
}
