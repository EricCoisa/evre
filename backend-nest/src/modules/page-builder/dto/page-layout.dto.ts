import { z } from 'zod';

/** labelKey da `UserConfigurationDefinition` (JSON) com o mapa `pageKey → PageLayout` do usuário. */
export const PAGE_LAYOUTS_KEY = 'PAGE_LAYOUTS';

/** Superfícies que o PageBuilder monta. Espelha `frontend-next/src/lib/page-builder/profiles.ts`
 * — o backend usa só o que decide a escrita; a lista de blocos e de classNames vem pela ponte. */
export const LAYOUT_PROFILES = {
  dashboard: {
    dataSources: 'role-filtered',
    storage: 'config',
    maxBlocks: 20,
    maxChildren: 12,
  },
  proposal: {
    dataSources: 'none',
    storage: 'record',
    maxBlocks: 80,
    maxChildren: 12,
  },
} as const;

export type LayoutProfileName = keyof typeof LAYOUT_PROFILES;
export type LayoutProfile = (typeof LAYOUT_PROFILES)[LayoutProfileName];

/** Profile de quem não declara nada — a superfície que existia antes de haver profile. */
export const DEFAULT_LAYOUT_PROFILE: LayoutProfileName = 'dashboard';

const PROFILE_NAMES = Object.keys(LAYOUT_PROFILES) as [
  LayoutProfileName,
  ...LayoutProfileName[],
];

/** Teto de blocos por página do `dashboard` — evita que um layout gerado por LLM vire uma tela infinita. */
export const MAX_BLOCKS = LAYOUT_PROFILES.dashboard.maxBlocks;

/** Teto de filhos por bloco container do `dashboard`. */
export const MAX_CHILDREN = LAYOUT_PROFILES.dashboard.maxChildren;

// O schema aceita o teto do profile mais largo; quem recusa pelo teto do profile recebido é o
// PageLayoutValidator, que já tem o profile em mãos e devolve mensagem que o modelo entende.
const WIDEST_BLOCKS = Math.max(
  ...Object.values(LAYOUT_PROFILES).map((p) => p.maxBlocks),
);
const WIDEST_CHILDREN = Math.max(
  ...Object.values(LAYOUT_PROFILES).map((p) => p.maxChildren),
);

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
  children: z.array(LeafBlockSchema).max(WIDEST_CHILDREN).optional(),
});

export const PageLayoutSchema = z.object({
  v: z.literal(1),
  blocks: z.array(PageBlockSchema).max(WIDEST_BLOCKS),
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
  /** Superfície de destino — decide blocos, classNames, fonte de dado e persistência.
   * Ausente vale `dashboard`, o default aplicado pelo `PageLayoutValidator`. */
  profile: z.enum(PROFILE_NAMES).optional(),
  layout: LayoutInput,
});

export type PageBlock = z.infer<typeof PageBlockSchema>;
export type PageLayout = z.infer<typeof PageLayoutSchema>;
export type SetPageLayoutInput = z.infer<typeof SetPageLayoutSchema>;
