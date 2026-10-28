import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

// React 19 hoists <title>/<meta>/<link> into document.head regardless of where they're
// rendered — mocking next/head as a passthrough lets those tags reach document.head under jsdom,
// since the real next/head component is a no-op outside Next's App Router (no HeadManagerContext).
vi.mock('next/head', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { SEO, generateSEOMetadata } from './seo';

afterEach(() => {
  vi.unstubAllEnvs();
});

function meta(selector: string) {
  return document.head.querySelector(selector);
}

describe('SEO', () => {
  it('renderiza title e meta description quando informados', () => {
    render(<SEO title="Título" description="Descrição" />);
    expect(document.title).toBe('Título');
    expect(meta('meta[name="description"]')?.getAttribute('content')).toBe('Descrição');
  });

  it('não renderiza title nem meta description quando omitidos', () => {
    render(<SEO />);
    expect(document.querySelector('title')).toBeNull();
    expect(meta('meta[name="description"]')).toBeNull();
  });

  it('meta robots default é "index, follow"', () => {
    render(<SEO />);
    expect(meta('meta[name="robots"]')?.getAttribute('content')).toBe('index, follow');
  });

  it('meta robots reflete noindex e nofollow combinados', () => {
    render(<SEO noindex nofollow />);
    expect(meta('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
  });

  it('meta robots reflete apenas noindex', () => {
    render(<SEO noindex />);
    expect(meta('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });

  it('link canonical só aparece quando canonicalUrl é passado', () => {
    const { unmount } = render(<SEO canonicalUrl="https://x.com/page" />);
    expect(meta('link[rel="canonical"]')?.getAttribute('href')).toBe('https://x.com/page');
    unmount();

    render(<SEO />);
    expect(meta('link[rel="canonical"]')).toBeNull();
  });

  it('OpenGraph: og:type default website, og:url a partir de canonicalUrl', () => {
    render(<SEO canonicalUrl="https://x.com/page" />);
    expect(meta('meta[property="og:type"]')?.getAttribute('content')).toBe('website');
    expect(meta('meta[property="og:url"]')?.getAttribute('content')).toBe('https://x.com/page');
  });

  it('OpenGraph: usa o ogType informado', () => {
    render(<SEO ogType="product" />);
    expect(meta('meta[property="og:type"]')?.getAttribute('content')).toBe('product');
  });

  it('OpenGraph: imagem string usa title como alt', () => {
    render(<SEO title="Título" image="https://img/x.png" />);
    expect(meta('meta[property="og:image"]')?.getAttribute('content')).toBe('https://img/x.png');
    expect(meta('meta[property="og:image:alt"]')?.getAttribute('content')).toBe('Título');
  });

  it('OpenGraph: imagem objeto usa seu próprio alt', () => {
    render(<SEO title="Título" image={{ url: 'https://img/y.png', alt: 'Alt custom' }} />);
    expect(meta('meta[property="og:image"]')?.getAttribute('content')).toBe('https://img/y.png');
    expect(meta('meta[property="og:image:alt"]')?.getAttribute('content')).toBe('Alt custom');
  });

  it('OpenGraph: não renderiza og:image quando não há imagem', () => {
    render(<SEO title="Título" />);
    expect(meta('meta[property="og:image"]')).toBeNull();
    expect(meta('meta[property="og:image:alt"]')).toBeNull();
  });

  it('OpenGraph: og:site_name vem de NEXT_PUBLIC_SITE_NAME', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_NAME', 'Minha Site');
    render(<SEO />);
    expect(meta('meta[property="og:site_name"]')?.getAttribute('content')).toBe('Minha Site');
  });

  it('Twitter: usa o twitterCard informado', () => {
    render(<SEO twitterCard="summary" />);
    expect(meta('meta[name="twitter:card"]')?.getAttribute('content')).toBe('summary');
  });

  it('Twitter: default é summary_large_image e reflete título/descrição/imagem', () => {
    render(<SEO title="Título" description="Desc" image="https://img/z.png" />);
    expect(meta('meta[name="twitter:card"]')?.getAttribute('content')).toBe('summary_large_image');
    expect(meta('meta[name="twitter:title"]')?.getAttribute('content')).toBe('Título');
    expect(meta('meta[name="twitter:description"]')?.getAttribute('content')).toBe('Desc');
    expect(meta('meta[name="twitter:image"]')?.getAttribute('content')).toBe('https://img/z.png');
    expect(meta('meta[name="twitter:image:alt"]')?.getAttribute('content')).toBe('Título');
  });
});

describe('generateSEOMetadata (export de seo.tsx)', () => {
  it('monta title/description/robots default', () => {
    const metadata = generateSEOMetadata({ title: 'T', description: 'D' });
    expect(metadata.title).toBe('T');
    expect(metadata.description).toBe('D');
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it('só inclui alternates.canonical quando canonicalUrl é passado', () => {
    expect(generateSEOMetadata({ canonicalUrl: 'https://x.com/a' }).alternates).toEqual({
      canonical: 'https://x.com/a',
    });
    expect(generateSEOMetadata({}).alternates).toBeUndefined();
  });

  it('extrai imagem string com title como alt, propagando para openGraph e twitter', () => {
    const metadata = generateSEOMetadata({ title: 'T', image: 'https://img/a.png' });
    expect(metadata.openGraph?.images).toEqual([{ url: 'https://img/a.png', alt: 'T' }]);
    expect(metadata.twitter?.images).toEqual(['https://img/a.png']);
  });

  it('twitter.card é sempre summary_large_image, independente da prop twitterCard', () => {
    const metadata = generateSEOMetadata({ twitterCard: 'summary' });
    expect(metadata.twitter?.card).toBe('summary_large_image');
  });

  it('propaga NEXT_PUBLIC_SITE_NAME para openGraph.siteName', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_NAME', 'Minha Site');
    expect(generateSEOMetadata({}).openGraph?.siteName).toBe('Minha Site');
  });

  it('nega index/follow quando noindex/nofollow são true', () => {
    expect(generateSEOMetadata({ noindex: true, nofollow: true }).robots).toEqual({
      index: false,
      follow: false,
    });
  });
});
