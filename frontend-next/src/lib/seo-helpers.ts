import type { Metadata } from 'next';

export interface SEOProps {
  title?: string;
  description?: string;
  image?: string | { url?: string; alt?: string };
  canonicalUrl?: string;
  noindex?: boolean;
  nofollow?: boolean;
  ogType?: 'website' | 'article';
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
}

/** Extrai URL e alt da imagem de SEO, aceitando string ou objeto `{ url, alt }`. */
function extractImage(image: SEOProps['image'], title?: string): { url: string; alt: string } {
  const url = typeof image === 'string' ? image : image?.url || '';
  const alt = typeof image === 'object' && image?.alt ? image.alt : title || '';
  return { url, alt };
}

/** Gera o objeto Metadata do Next.js a partir das props de SEO. */
export function generateSEOMetadata(props: SEOProps): Metadata {
  const {
    title,
    description,
    image,
    canonicalUrl,
    noindex = false,
    nofollow = false,
    ogType = 'website',
  } = props;

  const { url: imageUrl, alt: imageAlt } = extractImage(image, title);
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME;

  return {
    title,
    description,
    ...(canonicalUrl && {
      alternates: {
        canonical: canonicalUrl,
      },
    }),
    robots: {
      index: !noindex,
      follow: !nofollow,
    },
    openGraph: {
      title,
      description,
      type: ogType,
      url: canonicalUrl,
      siteName,
      ...(imageUrl && {
        images: [
          {
            url: imageUrl,
            alt: imageAlt,
          },
        ],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(imageUrl && {
        images: [imageUrl],
      }),
    },
  };
}

/** Resolve título/descrição/imagem/canonical do plugin-seo do Payload, com fallbacks. */
function resolvePayloadMeta(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  fallbacks: { title?: string; description?: string; canonicalUrl?: string },
  siteUrl: string,
) {
  const meta: {
    title?: string;
    description?: string;
    image?: string | { url?: string; alt?: string };
    cannonicalUrl?: string;
  } = data?.meta || {};

  return {
    title: meta.title || fallbacks.title,
    description: meta.description || fallbacks.description,
    image: meta.image,
    canonicalUrl: meta.cannonicalUrl || fallbacks.canonicalUrl || siteUrl,
  };
}

/** Extrai metadata de qualquer collection do Payload CMS, com fallbacks. */
export function generateMetadataFromPayload(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  fallbacks: { title?: string; description?: string; canonicalUrl?: string },
  options?: { ogType?: SEOProps['ogType']; noindex?: boolean; nofollow?: boolean }
): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return generateSEOMetadata({
    ...resolvePayloadMeta(data, fallbacks, siteUrl),
    ogType: options?.ogType || 'website',
    noindex: options?.noindex || false,
    nofollow: options?.nofollow || false,
  });
}
