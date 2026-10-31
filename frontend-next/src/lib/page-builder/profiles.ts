import { blocksForProfile, type BlockType } from './blocks.meta';

export type LayoutProfileName = 'dashboard' | 'proposal';

export interface LayoutProfile {
  /** Tipos de bloco que este profile oferece — derivados dinamicamente de `BLOCK_META`. */
  readonly blocks: readonly BlockType[];
  /** `role-filtered` confere a fonte contra o alcance de quem grava (busca real); `inline-only`
   * recusa `data.source` e só aceita `data.inline` (payload colado, congelado no layout); `none`
   * recusa os dois — nenhum dado, de forma nenhuma. */
  dataSources: 'role-filtered' | 'none' | 'inline-only';
  /** `config` guarda o layout em User/SystemConfiguration; `record` em registro próprio (sem `pageKey` de catálogo). */
  storage: 'config' | 'record';
  maxBlocks: number;
  maxChildren: number;
}

/** Superfícies que o PageBuilder monta. Cada profile decide fonte de dado, persistência e tetos; os blocos vêm de BLOCK_META. */
export const LAYOUT_PROFILES: Record<LayoutProfileName, LayoutProfile> = {
  dashboard: {
    get blocks() {
      return blocksForProfile('dashboard');
    },
    dataSources: 'role-filtered',
    storage: 'config',
    maxBlocks: 20,
    maxChildren: 12,
  },
  proposal: {
    get blocks() {
      return blocksForProfile('proposal');
    },
    dataSources: 'inline-only',
    storage: 'record',
    maxBlocks: 80,
    maxChildren: 12,
  },
};

/** Profile de quem não declara nada — a superfície que existia antes de haver profile. */
export const DEFAULT_PROFILE = 'dashboard' satisfies LayoutProfileName;

export function isLayoutProfileName(value: unknown): value is LayoutProfileName {
  return typeof value === 'string' && value in LAYOUT_PROFILES;
}
