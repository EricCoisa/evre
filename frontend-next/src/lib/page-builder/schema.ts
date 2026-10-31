import { z } from 'zod';
import {
  DEFAULT_PROFILE,
  LAYOUT_PROFILES,
  type LayoutProfileName,
} from './profiles';

/** labelKey da UserConfigurationDefinition (valueType JSON) que guarda o mapa de layouts. */
export const PAGE_LAYOUTS_KEY = 'PAGE_LAYOUTS';

// Tetos do profile `dashboard`; o editor desabilita "adicionar" ao atingir o teto.
export const MAX_BLOCKS = LAYOUT_PROFILES.dashboard.maxBlocks;
export const MAX_CHILDREN = LAYOUT_PROFILES.dashboard.maxChildren;

export function maxBlocksFor(profile: LayoutProfileName = DEFAULT_PROFILE): number {
  return LAYOUT_PROFILES[profile].maxBlocks;
}

export function maxChildrenFor(
  profile: LayoutProfileName = DEFAULT_PROFILE,
): number {
  return LAYOUT_PROFILES[profile].maxChildren;
}

// O schema aceita o teto do profile mais largo; quem recusa pelo teto do profile ativo é o
// validador do backend, que sabe qual profile está gravando.
const profiles = Object.values(LAYOUT_PROFILES);
const WIDEST_BLOCKS = Math.max(...profiles.map((p) => p.maxBlocks));
const WIDEST_CHILDREN = Math.max(...profiles.map((p) => p.maxChildren));

const LeafBlockSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  span: z.number().int().min(1).max(12).optional(),
  rowSpan: z.number().int().min(1).max(8).optional(),
  x: z.number().int().min(0).max(11).optional(),
  y: z.number().int().min(0).max(99).optional(),
  /** Classes Tailwind da allowlist (`class-names.ts`), separadas por espaço. */
  className: z.string().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  // `source` (fonte real, resolvida em runtime) e `inline` (payload colado, congelado no
  // layout) são mutuamente exclusivos — um bloco com os dois é recusado aqui mesmo, antes de
  // chegar no validador semântico. `inline` fica `z.unknown()` de propósito: a shape (list ×
  // series) depende do `kind` que o bloco aceita, e isso é checado no backend
  // (`page-layout-validator.service.ts`), nunca aqui — senão toda evolução de `kind` vira
  // mudança de schema de layout, e layout publicado é imutável.
  data: z
    .object({
      source: z.string().min(1).optional(),
      params: z.record(z.string(), z.unknown()).optional(),
      inline: z.unknown().optional(),
    })
    .refine((d) => d.source === undefined || d.inline === undefined, {
      message: '"source" e "inline" são mutuamente exclusivos no mesmo bloco',
    })
    .optional(),
});

// Espelha backend-nest/src/modules/page-builder/dto/page-layout.dto.ts: UM nível de
// aninhamento, filho não tem `children`.
export const PageBlockSchema = LeafBlockSchema.extend({
  children: z.array(LeafBlockSchema).max(WIDEST_CHILDREN).optional(),
});

export const PageLayoutSchema = z.object({
  // ponytail: um membro só, alargar agora é ruído. F1-05 já publica layout imutável em
  // ProposalVersion.layout — a partir daqui, layout antigo precisa continuar renderizando para
  // sempre. `v: z.literal(1)` virar uma união (`z.literal(1) | z.literal(2) | ...`) com um
  // renderer por versão passa a ser obrigatório ANTES da primeira mudança de schema de bloco —
  // hoje layout inválido cai em fallback (`EMPTY_LAYOUT`), e numa proposta publicada isso é
  // documento comercial em branco, não um grid vazio de rascunho.
  v: z.literal(1),
  blocks: z.array(PageBlockSchema).max(WIDEST_BLOCKS),
});

export type PageBlock = z.infer<typeof PageBlockSchema>;
export type PageLayout = z.infer<typeof PageLayoutSchema>;

/** Ponto de partida de quem nunca customizou a página — único também para `editor/mutations.ts`. */
export const EMPTY_LAYOUT: PageLayout = { v: 1, blocks: [] };

/** `span` é token, nunca CSS: o Tailwind faz purge estático e classe montada em runtime some do bundle. */
export const SPAN_CLASS: Record<number, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  10: 'lg:col-span-10',
  11: 'lg:col-span-11',
  12: 'lg:col-span-12',
} as const;

export const COL_START_CLASS: Record<number, string> = {
  0: 'lg:col-start-1',
  1: 'lg:col-start-2',
  2: 'lg:col-start-3',
  3: 'lg:col-start-4',
  4: 'lg:col-start-5',
  5: 'lg:col-start-6',
  6: 'lg:col-start-7',
  7: 'lg:col-start-8',
  8: 'lg:col-start-9',
  9: 'lg:col-start-10',
  10: 'lg:col-start-11',
  11: 'lg:col-start-12',
} as const;

export const ROW_SPAN_CLASS: Record<number, string> = {
  1: 'lg:row-span-1',
  2: 'lg:row-span-2',
  3: 'lg:row-span-3',
  4: 'lg:row-span-4',
  5: 'lg:row-span-5',
  6: 'lg:row-span-6',
  7: 'lg:row-span-7',
  8: 'lg:row-span-8',
} as const;

export const ROW_START_CLASS: Record<number, string> = {
  0: 'lg:row-start-1',
  1: 'lg:row-start-2',
  2: 'lg:row-start-3',
  3: 'lg:row-start-4',
  4: 'lg:row-start-5',
  5: 'lg:row-start-6',
  6: 'lg:row-start-7',
  7: 'lg:row-start-8',
  8: 'lg:row-start-9',
  9: 'lg:row-start-10',
  10: 'lg:row-start-11',
  11: 'lg:row-start-12',
  12: 'lg:row-start-13',
  13: 'lg:row-start-14',
  14: 'lg:row-start-15',
  15: 'lg:row-start-16',
  16: 'lg:row-start-17',
  17: 'lg:row-start-18',
  18: 'lg:row-start-19',
  19: 'lg:row-start-20',
  20: 'lg:row-start-21',
  21: 'lg:row-start-22',
  22: 'lg:row-start-23',
  23: 'lg:row-start-24',
  24: 'lg:row-start-25',
  25: 'lg:row-start-26',
  26: 'lg:row-start-27',
  27: 'lg:row-start-28',
  28: 'lg:row-start-29',
  29: 'lg:row-start-30',
} as const;

export const SPANS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type BlockSpan = (typeof SPANS)[number];

export const ROW_SPANS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type BlockRowSpan = (typeof ROW_SPANS)[number];

export const QUICK_WIDTHS: { label: string; span: BlockSpan }[] = [
  { label: '16%', span: 2 },
  { label: '25%', span: 3 },
  { label: '33%', span: 4 },
  { label: '50%', span: 6 },
  { label: '66%', span: 8 },
  { label: '75%', span: 9 },
  { label: '83%', span: 10 },
  { label: '100%', span: 12 },
];

export const QUICK_HEIGHTS: { label: string; rowSpan: BlockRowSpan }[] = [
  { label: '1x (Compacto)', rowSpan: 1 },
  { label: '2x (Médio)', rowSpan: 2 },
  { label: '3x (Alto)', rowSpan: 3 },
  { label: '4x (Extra)', rowSpan: 4 },
];

export function normalizeSpan(span?: number): BlockSpan {
  if (!span) return 12;
  const clamped = Math.min(12, Math.max(1, Math.round(span)));
  return clamped as BlockSpan;
}

export function minRowSpanForType(type?: string): BlockRowSpan {
  if (!type) return 1;
  if (
    type.startsWith('chart.') ||
    type.startsWith('table.') ||
    type === 'list.feed'
  ) {
    return 2;
  }
  return 1;
}

export function defaultRowSpanForType(type?: string): BlockRowSpan {
  if (!type) return 1;
  if (
    type.startsWith('chart.') ||
    type.startsWith('table.') ||
    type === 'list.feed'
  ) {
    return 4;
  }
  if (type === 'group') {
    return 2;
  }
  return 1;
}

export function normalizeRowSpan(rowSpan?: number, type?: string): BlockRowSpan {
  const min = minRowSpanForType(type);
  if (!rowSpan) return defaultRowSpanForType(type);
  if (rowSpan <= 2 && min > 1) return defaultRowSpanForType(type);
  const clamped = Math.min(8, Math.max(min, Math.round(rowSpan)));
  return clamped as BlockRowSpan;
}

export type LayoutResult =
  /** Usuário não customizou esta página (ou zerou os blocos) — fallback em silêncio. */
  | { status: 'none' }
  /** Existe layout salvo, mas ele não bate com o schema — fallback + aviso e reset. */
  | { status: 'invalid' }
  | { status: 'ok'; layout: PageLayout };

/** De onde veio o layout que está na tela. */
export type LayoutOrigin = 'user' | 'system' | 'none';

export type ResolvedLayout = LayoutResult & { origin: LayoutOrigin };

/** Resolve o layout da página seguindo a precedência: usuário → sistema → padrão em código. */
export function resolvePageLayout(
  userRaw: unknown,
  systemRaw: unknown,
  pageKey: string,
): ResolvedLayout {
  const user = parsePageLayout(userRaw, pageKey);
  if (user.status === 'ok') return { ...user, origin: 'user' };
  if (user.status === 'invalid') return { ...user, origin: 'user' };

  const system = parsePageLayout(systemRaw, pageKey);
  if (system.status === 'ok') return { ...system, origin: 'system' };

  return { status: 'none', origin: 'none' };
}

/** Lê o layout de uma página do mapa `{ [pageKey]: layout }` de PAGE_LAYOUTS (`storage: 'config'`);
 * nunca lança, cai em 'none'/'invalid'. Para um registro próprio (`storage: 'record'`, sem mapa),
 * use `parseRecordLayout`. */
export function parsePageLayout(raw: unknown, pageKey: string): LayoutResult {
  const value = typeof raw === 'string' ? tryJsonParse(raw) : raw;
  if (!value || typeof value !== 'object') return { status: 'none' };
  const entry = (value as Record<string, unknown>)[pageKey];
  if (entry === undefined || entry === null) return { status: 'none' };
  const parsed = PageLayoutSchema.safeParse(entry);
  if (!parsed.success) return { status: 'invalid' };
  // Layout sem bloco equivale a não ter customizado: devolve o fallback da página em código.
  if (parsed.data.blocks.length === 0) return { status: 'none' };

  return { status: 'ok', layout: parsed.data };
}

/** Lê o `PageLayout` puro de um registro próprio (`storage: 'record'`, sem o mapa `{ [pageKey]:
 * layout }` que `parsePageLayout` espera); nunca lança, cai em `EMPTY_LAYOUT`. */
export function parseRecordLayout(raw: unknown): PageLayout {
  const parsed = PageLayoutSchema.safeParse(raw);
  return parsed.success ? parsed.data : EMPTY_LAYOUT;
}

function tryJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
