import { LegalPages } from '../legalPages/LegalPages';

describe('LegalPages collection contract', () => {
  it('has slug "legal-pages"', () => {
    expect(LegalPages.slug).toBe('legal-pages');
  });

  it('restricts public read to published documents', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = LegalPages.access?.read?.({ req: { user: null } } as any);
    expect(result).toEqual({ published: { equals: true } });
  });

  it('allows authenticated users to read all documents (including drafts)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = LegalPages.access?.read?.({ req: { user: { id: '1' } } } as any);
    expect(result).toBe(true);
  });

  it('requires an authenticated user to create, update or delete', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(LegalPages.access?.create?.({ req: { user: null } } as any)).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(LegalPages.access?.create?.({ req: { user: { id: '1' } } } as any)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(LegalPages.access?.update?.({ req: { user: { id: '1' } } } as any)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(LegalPages.access?.delete?.({ req: { user: { id: '1' } } } as any)).toBe(true);
  });

  it('has title, slug, content and published fields', () => {
    const fields = LegalPages.fields ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byName = (name: string) => fields.find((f: any) => f.name === name) as any;

    expect(byName('title')?.required).toBe(true);

    const slugField = byName('slug');
    expect(slugField?.required).toBe(true);
    expect(slugField?.unique).toBe(true);

    expect(byName('content')?.type).toBe('richText');
    expect(byName('content')?.required).toBe(true);

    const publishedField = byName('published');
    expect(publishedField?.type).toBe('checkbox');
    expect(publishedField?.defaultValue).toBe(false);
    expect(publishedField?.label).toEqual({ en: 'Published', pt: 'Publicado' });
  });

  it('builds preview and live preview URLs from the document slug', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const preview = LegalPages.admin?.preview as (doc: any) => string;
    expect(preview({ slug: 'termo-uso' })).toContain('/legal/termo-uso?preview=true');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const livePreviewUrl = LegalPages.admin?.livePreview?.url as (args: any) => string;
    expect(livePreviewUrl({ data: { slug: 'termo-uso' } })).toContain('/legal/termo-uso?preview=true');
  });

  it('rejects slugs with uppercase letters, spaces or leading/trailing hyphens', () => {
    const fields = LegalPages.fields ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slugField = fields.find((f: any) => f.name === 'slug') as any;
    const validate = slugField.validate as (value: string) => string | true;

    expect(validate('privacy-policy')).toBe(true);
    expect(validate('Privacy-Policy')).not.toBe(true);
    expect(validate('privacy policy')).not.toBe(true);
    expect(validate('-privacy-policy-')).not.toBe(true);
  });
});
