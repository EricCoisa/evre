import { DEFAULT_PROFILE, type LayoutProfileName } from './profiles';

/** Classes Tailwind permitidas em blocos do profile `dashboard`. */
export const ALLOWED_CLASS_NAMES = [
  // layout
  'h-full', 'w-full', 'flex', 'flex-col', 'flex-row', 'flex-wrap', 'flex-1',
  'items-start', 'items-center', 'items-end',
  'justify-start', 'justify-center', 'justify-end', 'justify-between',
  'gap-0', 'gap-1', 'gap-2', 'gap-3', 'gap-4', 'gap-6', 'gap-8',
  // espaçamento
  'p-0', 'p-1', 'p-2', 'p-3', 'p-4', 'p-6', 'p-8',
  'px-0', 'px-2', 'px-4', 'px-6', 'py-0', 'py-2', 'py-4', 'py-6',
  'mt-0', 'mt-2', 'mt-4', 'mt-6', 'mb-0', 'mb-2', 'mb-4', 'mb-6',
  // tipografia
  'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl',
  'font-normal', 'font-medium', 'font-semibold', 'font-bold',
  'text-left', 'text-center', 'text-right',
  'tabular-nums', 'truncate', 'uppercase', 'capitalize', 'leading-tight', 'leading-none',
  // cores do tema
  'text-foreground', 'text-muted-foreground', 'text-primary', 'text-destructive',
  'bg-card', 'bg-muted', 'bg-accent', 'bg-primary/5', 'bg-destructive/10',
  // bordas e superfície
  'border', 'border-0', 'border-t', 'border-b', 'border-dashed',
  'rounded-md', 'rounded-lg', 'rounded-xl', 'shadow-sm', 'shadow-none',
  'overflow-hidden', 'overflow-x-auto',
] as const;

/** Vocabulário editorial de página de leitura (proposta): medida de linha, ritmo vertical e ênfase. */
export const EDITORIAL_CLASS_NAMES = [
  'max-w-prose', 'mx-auto', 'aspect-video',
  'tracking-tight', 'tracking-wide', 'leading-relaxed', 'text-5xl',
  'italic', 'underline', 'border-l-4',
  'space-y-2', 'space-y-4', 'space-y-6', 'space-y-8',
] as const;

const BY_PROFILE: Record<LayoutProfileName, readonly string[]> = {
  dashboard: ALLOWED_CLASS_NAMES,
  proposal: [...ALLOWED_CLASS_NAMES, ...EDITORIAL_CLASS_NAMES],
};

/** Allowlist publicada ao validador e ao editor. Sem profile cai no `dashboard`. */
export function classNamesFor(profile?: LayoutProfileName): string[] {
  return [...BY_PROFILE[profile ?? DEFAULT_PROFILE]];
}

// A leitura é permissiva de propósito: o conjunto é a união de todos os profiles, porque quem
// recusa classe fora do profile é a escrita (o validador), e descartar classe já gravada
// mudaria a tela sem o autor poder corrigir.
const ALLOWED = new Set<string>([
  ...ALLOWED_CLASS_NAMES,
  ...EDITORIAL_CLASS_NAMES,
]);

/** Mantém só os tokens conhecidos, descartando o resto em silêncio para não quebrar layout já gravado. */
export function filterClassName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const kept = raw.split(/\s+/).filter((token) => ALLOWED.has(token));
  return kept.length ? kept.join(' ') : undefined;
}

/** Traduz o alinhamento do bloco para classes `text-*` nos slots internos (largura total). */
const INNER_ALIGN: Record<string, string> = {
  'items-start': 'text-left',
  'items-center': 'text-center',
  'items-end': 'text-right',
};

export function innerAlignClass(className: unknown): string | undefined {
  if (typeof className !== 'string') return undefined;
  const token = className.split(/\s+/).find((t) => t in INNER_ALIGN);
  return token ? INNER_ALIGN[token] : undefined;
}
