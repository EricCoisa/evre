import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPayload } from 'payload';
import { notFound } from 'next/navigation';
import LegalPage from './page';

vi.mock('payload', () => ({ getPayload: vi.fn() }));
vi.mock('@payload-config', () => ({ default: {} }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock('@payloadcms/richtext-lexical/react', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RichText: ({ data }: { data: any }) => <div data-testid="rich-text">{JSON.stringify(data)}</div>,
}));

const mockFind = vi.fn();

beforeEach(() => {
  mockFind.mockReset();
  vi.mocked(getPayload).mockResolvedValue({ find: mockFind } as never);
  vi.mocked(notFound).mockClear();
});

describe('/legal/[slug] page', () => {
  it('renders a published legal page', async () => {
    mockFind.mockResolvedValue({
      docs: [{ id: '1', title: 'Privacy Policy', content: { root: { children: [] } } }],
    });

    const result = await LegalPage({
      params: Promise.resolve({ slug: 'privacy-policy' }),
      searchParams: Promise.resolve({}),
    });

    expect(result).toBeTruthy();
    expect(mockFind).toHaveBeenCalledWith({
      collection: 'legal-pages',
      where: {
        slug: { equals: 'privacy-policy' },
        published: { equals: true },
      },
      limit: 1,
    });
    expect(notFound).not.toHaveBeenCalled();
  });

  it('returns 404 for a document that exists but is not published', async () => {
    // The published:true filter is applied in the query itself, so an existing-but-unpublished
    // document never comes back — same as a slug that doesn't exist at all.
    mockFind.mockResolvedValue({ docs: [] });

    await expect(
      LegalPage({ params: Promise.resolve({ slug: 'draft-terms' }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('returns 404 for a slug that does not exist', async () => {
    mockFind.mockResolvedValue({ docs: [] });

    await expect(
      LegalPage({ params: Promise.resolve({ slug: 'does-not-exist' }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('with ?preview=true, fetches including drafts (no published filter)', async () => {
    mockFind.mockResolvedValue({
      docs: [{ id: '1', title: 'Draft Terms', slug: 'draft-terms', content: { root: { children: [] } } }],
    });

    const result = await LegalPage({
      params: Promise.resolve({ slug: 'draft-terms' }),
      searchParams: Promise.resolve({ preview: 'true' }),
    });

    expect(result).toBeTruthy();
    expect(mockFind).toHaveBeenCalledWith({
      collection: 'legal-pages',
      where: { slug: { equals: 'draft-terms' } },
      limit: 1,
    });
    expect(notFound).not.toHaveBeenCalled();
  });
});
