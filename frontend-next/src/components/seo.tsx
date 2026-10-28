'use client';

import Head from 'next/head';

export interface SEOProps {
  title?: string;
  description?: string;
  image?: string | { url?: string; alt?: string };
  canonicalUrl?: string;
  noindex?: boolean;
  nofollow?: boolean;
  ogType?: 'website' | 'article' | 'product';
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
}

function extractImageInfo(image?: string | { url?: string; alt?: string }, fallbackTitle?: string) {
  const imageUrl = typeof image === 'string' ? image : image?.url || '';
  const imageAlt = typeof image === 'object' && image?.alt ? image.alt : fallbackTitle || '';
  return { imageUrl, imageAlt };
}

function resolveRobotsContent(noindex = false, nofollow = false): string {
  const parts: string[] = [];
  if (noindex) parts.push('noindex');
  if (nofollow) parts.push('nofollow');
  return parts.length > 0 ? parts.join(', ') : 'index, follow';
}

function OpenGraphMeta({
  title,
  description,
  ogType,
  canonicalUrl,
  imageUrl,
  imageAlt,
  siteName,
}: {
  title?: string;
  description?: string;
  ogType: string;
  canonicalUrl?: string;
  imageUrl: string;
  imageAlt: string;
  siteName?: string;
}) {
  return (
    <>
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      <meta property="og:type" content={ogType} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      {imageUrl && <meta property="og:image" content={imageUrl} />}
      {imageUrl && imageAlt && <meta property="og:image:alt" content={imageAlt} />}
      {siteName && <meta property="og:site_name" content={siteName} />}
    </>
  );
}

function TwitterCardMeta({
  twitterCard,
  title,
  description,
  imageUrl,
  imageAlt,
}: {
  twitterCard: string;
  title?: string;
  description?: string;
  imageUrl: string;
  imageAlt: string;
}) {
  return (
    <>
      <meta name="twitter:card" content={twitterCard} />
      {title && <meta name="twitter:title" content={title} />}
      {description && <meta name="twitter:description" content={description} />}
      {imageUrl && <meta name="twitter:image" content={imageUrl} />}
      {imageUrl && imageAlt && <meta name="twitter:image:alt" content={imageAlt} />}
    </>
  );
}

/** Renderiza meta tags de SEO (Open Graph, Twitter Card, robots) client-side a partir do Payload CMS. */
export function SEO({
  title,
  description,
  image,
  canonicalUrl,
  noindex = false,
  nofollow = false,
  ogType = 'website',
  twitterCard = 'summary_large_image',
}: SEOProps) {
  const { imageUrl, imageAlt } = extractImageInfo(image, title);
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME;
  const robotsContent = resolveRobotsContent(noindex, nofollow);

  return (
    <Head>
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
      <meta name="robots" content={robotsContent} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      <OpenGraphMeta
        title={title}
        description={description}
        ogType={ogType}
        canonicalUrl={canonicalUrl}
        imageUrl={imageUrl}
        imageAlt={imageAlt}
        siteName={siteName}
      />

      <TwitterCardMeta
        twitterCard={twitterCard}
        title={title}
        description={description}
        imageUrl={imageUrl}
        imageAlt={imageAlt}
      />
    </Head>
  );
}

/** Gera o objeto Metadata do Next.js a partir de dados de SEO, para uso em generateMetadata(). */
export function generateSEOMetadata(props: SEOProps) {
  const {
    title,
    description,
    image,
    canonicalUrl,
    noindex = false,
    nofollow = false,
    ogType = 'website',
  } = props;

  const { imageUrl, imageAlt } = extractImageInfo(image, title);
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME;

  return {
    title,
    description,
    ...(canonicalUrl && { alternates: { canonical: canonicalUrl } }),
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
      ...(imageUrl && { images: [{ url: imageUrl, alt: imageAlt }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
}
