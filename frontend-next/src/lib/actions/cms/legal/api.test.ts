import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetPayload = vi.hoisted(() => vi.fn());
vi.mock('payload', () => ({ getPayload: mockGetPayload }));
vi.mock('@payload-config', () => ({ default: {} }));

import { getLegalPage } from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getLegalPage', () => {
  it('busca a página legal publicada pelo slug', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ id: 'p1', slug: 'termos' }] });
    mockGetPayload.mockResolvedValue({ find });

    const result = await getLegalPage('termos');

    expect(find).toHaveBeenCalledWith({
      collection: 'legal-pages',
      where: { slug: { equals: 'termos' }, published: { equals: true } },
      limit: 1,
    });
    expect(result).toEqual({ id: 'p1', slug: 'termos' });
  });

  it('inclui rascunhos quando includeDrafts é true', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] });
    mockGetPayload.mockResolvedValue({ find });

    const result = await getLegalPage('termos', { includeDrafts: true });

    expect(find).toHaveBeenCalledWith({
      collection: 'legal-pages',
      where: { slug: { equals: 'termos' } },
      limit: 1,
    });
    expect(result).toBeNull();
  });

  it('retorna null quando o Payload lança erro', async () => {
    mockGetPayload.mockRejectedValue(new Error('conexão falhou'));

    await expect(getLegalPage('termos')).resolves.toBeNull();
  });
});
