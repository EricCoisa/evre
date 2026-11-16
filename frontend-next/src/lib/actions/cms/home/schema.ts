import type { HomeData } from './type';

export function generateOrganizationSchema(data: HomeData, siteUrl: string) {
  return {
    '@context': 'https://schema.org' as const,
    '@type': 'Organization' as const,
    name: data.footerText,
    url: siteUrl,
    email: data.contactEmail,
    telephone: `+${data.heroWhatsappNumber}`,
    description: data.heroDescription,
  };
}
