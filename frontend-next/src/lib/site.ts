/** Nome do app, usado na logo (sidebar, CMS) e no SEO (ver seo-helpers.ts/seo.tsx). */
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? 'Template Base';

/** Até duas iniciais maiúsculas de um nome, para o ícone compacto da logo. */
export function siteInitials(name: string = SITE_NAME): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
