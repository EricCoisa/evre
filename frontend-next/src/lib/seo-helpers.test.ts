import { describe, it, expect, afterEach, vi } from 'vitest';
import { generateSEOMetadata, generateMetadataFromPayload } from './seo-helpers';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('generateSEOMetadata', () => {
  it('monta title/description e robots index+follow por padrão', () => {
    const metadata = generateSEOMetadata({ title: 'Título', description: 'Descrição' });

    expect(metadata.title).toBe('Título');
    expect(metadata.description).toBe('Descrição');
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.openGraph?.type).toBe('website');
  });

  it('nega index/follow quando noindex/nofollow são true', () => {
    const metadata = generateSEOMetadata({ noindex: true, nofollow: true });

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('só inclui alternates.canonical quando canonicalUrl é passado', () => {
    const withCanonical = generateSEOMetadata({ canonicalUrl: 'https://x.com/page' });
    const withoutCanonical = generateSEOMetadata({});

    expect(withCanonical.alternates).toEqual({ canonical: 'https://x.com/page' });
    expect(withoutCanonical.alternates).toBeUndefined();
  });

  it('usa o ogType informado em vez do default', () => {
    const metadata = generateSEOMetadata({ ogType: 'article' });
    expect(metadata.openGraph?.type).toBe('article');
  });

  it('extrai url e alt de uma imagem string, usando o title como alt', () => {
    const metadata = generateSEOMetadata({ title: 'Título', image: 'https://img/x.png' });

    expect(metadata.openGraph?.images).toEqual([{ url: 'https://img/x.png', alt: 'Título' }]);
    expect(metadata.twitter?.images).toEqual(['https://img/x.png']);
  });

  it('extrai url e alt de uma imagem objeto com alt próprio', () => {
    const metadata = generateSEOMetadata({
      title: 'Título',
      image: { url: 'https://img/y.png', alt: 'Alt customizado' },
    });

    expect(metadata.openGraph?.images).toEqual([{ url: 'https://img/y.png', alt: 'Alt customizado' }]);
  });

  it('cai no title como alt quando o objeto de imagem não traz alt', () => {
    const metadata = generateSEOMetadata({ title: 'Título', image: { url: 'https://img/z.png' } });

    expect(metadata.openGraph?.images).toEqual([{ url: 'https://img/z.png', alt: 'Título' }]);
  });

  it('não inclui images quando não há imagem', () => {
    const metadata = generateSEOMetadata({ title: 'Título' });

    expect(metadata.openGraph?.images).toBeUndefined();
    expect(metadata.twitter?.images).toBeUndefined();
  });

  it('sempre usa summary_large_image no twitter card, ignorando a prop twitterCard', () => {
    const metadata = generateSEOMetadata({ twitterCard: 'summary' });
    expect(metadata.twitter?.card).toBe('summary_large_image');
  });

  it('propaga NEXT_PUBLIC_SITE_NAME para openGraph.siteName', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_NAME', 'Minha Site');
    const metadata = generateSEOMetadata({});
    expect(metadata.openGraph?.siteName).toBe('Minha Site');
  });
});

describe('generateMetadataFromPayload', () => {
  it('usa title/description/canonical do meta do Payload quando presentes', () => {
    const data = {
      meta: { title: 'Meta Title', description: 'Meta Desc', cannonicalUrl: 'https://x.com/a' },
    };

    const metadata = generateMetadataFromPayload(data, { title: 'Fallback Title' }, undefined);

    expect(metadata.title).toBe('Meta Title');
    expect(metadata.description).toBe('Meta Desc');
    expect(metadata.alternates).toEqual({ canonical: 'https://x.com/a' });
  });

  it('cai nos fallbacks quando o meta do Payload não traz o campo', () => {
    const data = { meta: {} };

    const metadata = generateMetadataFromPayload(data, {
      title: 'Fallback Title',
      description: 'Fallback Desc',
      canonicalUrl: 'https://x.com/fallback',
    });

    expect(metadata.title).toBe('Fallback Title');
    expect(metadata.description).toBe('Fallback Desc');
    expect(metadata.alternates).toEqual({ canonical: 'https://x.com/fallback' });
  });

  it('cai no siteUrl (NEXT_PUBLIC_SITE_URL) quando nem meta nem fallback trazem canonicalUrl', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://meusite.com');
    const metadata = generateMetadataFromPayload({ meta: {} }, {});

    expect(metadata.alternates).toEqual({ canonical: 'https://meusite.com' });
  });

  it('cai no localhost quando NEXT_PUBLIC_SITE_URL não está definido', () => {
    const metadata = generateMetadataFromPayload({ meta: {} }, {});
    expect(metadata.alternates).toEqual({ canonical: 'http://localhost:3000' });
  });

  it('trata data undefined/sem meta como objeto vazio', () => {
    const metadata = generateMetadataFromPayload(undefined, { title: 'Fallback Title' });
    expect(metadata.title).toBe('Fallback Title');
  });

  it('usa ogType/noindex/nofollow vindos de options', () => {
    const metadata = generateMetadataFromPayload(
      { meta: {} },
      {},
      { ogType: 'article', noindex: true, nofollow: true },
    );

    expect(metadata.openGraph?.type).toBe('article');
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('propaga a imagem do meta do Payload', () => {
    const data = { meta: { title: 'T', image: { url: 'https://img/p.png', alt: 'Alt P' } } };
    const metadata = generateMetadataFromPayload(data, {});

    expect(metadata.openGraph?.images).toEqual([{ url: 'https://img/p.png', alt: 'Alt P' }]);
  });
});
