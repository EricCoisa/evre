/** Páginas que renderizam `<PageRenderer>` — o conjunto fechado de destinos customizáveis. */
export const PAGE_KEYS = {
  '/dashboard': 'Dashboard principal do usuário logado.',
} as const;

export type PageKey = keyof typeof PAGE_KEYS;

export function describePages() {
  return Object.entries(PAGE_KEYS).map(([pageKey, description]) => ({
    pageKey,
    description,
  }));
}
