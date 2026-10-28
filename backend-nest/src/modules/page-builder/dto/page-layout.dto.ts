import { z } from 'zod';

/** labelKey da `UserConfigurationDefinition` (JSON) com o mapa `pageKey → PageLayout` do usuário. */
export const PAGE_LAYOUTS_KEY = 'PAGE_LAYOUTS';

/** Teto de blocos por página — evita que um layout gerado por LLM vire uma tela infinita. */
export const MAX_BLOCKS = 20;

/** Teto de filhos por bloco container. */
export const MAX_CHILDREN = 12;

const LeafBlockSchema = z.object({
  id: z.string().min(1),
  /** Nome no registry de blocos do frontend. Validado lá, não aqui — ver comentário abaixo. */
  type: z.string().min(1),
  /** Token de grid 1–12, nunca CSS. O frontend mapeia para classes literais do Tailwind. */
  span: z.number().int().min(1).max(12).optional(),
  rowSpan: z.number().int().min(1).max(8).optional(),
  x: z.number().int().min(0).max(11).optional(),
  y: z.number().int().min(0).max(99).optional(),
  /** Classes Tailwind separadas por espaço, limitadas à allowlist publicada pelo frontend. */
  className: z.string().max(200).optional(),
  props: z.record(z.unknown()).optional(),
  data: z
    .object({
      source: z.string().min(1),
      params: z.record(z.unknown()).optional(),
    })
    .optional(),
});

// Um nível de aninhamento: filho não tem `children`. Grid dentro de grid exigiria z.lazy() com limite.
export const PageBlockSchema = LeafBlockSchema.extend({
  children: z.array(LeafBlockSchema).max(MAX_CHILDREN).optional(),
});

export const PageLayoutSchema = z.object({
  v: z.literal(1),
  blocks: z.array(PageBlockSchema).max(MAX_BLOCKS),
});

/** Aceita o layout como objeto ou como string JSON; o valor parseado passa pelo PageLayoutSchema estrito. */
const LayoutInput = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, PageLayoutSchema);

export const SetPageLayoutSchema = z.object({
  pageKey: z
    .string()
    .regex(/^\/[a-z0-9\-/]*$/, 'pageKey deve ser um path como "/dashboard"'),
  layout: LayoutInput,
});

export type PageBlock = z.infer<typeof PageBlockSchema>;
export type PageLayout = z.infer<typeof PageLayoutSchema>;
export type SetPageLayoutInput = z.infer<typeof SetPageLayoutSchema>;
