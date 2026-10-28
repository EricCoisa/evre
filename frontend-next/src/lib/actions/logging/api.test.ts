import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  loggingControllerFindAll: vi.fn(),
}));

vi.mock('@/lib/generated/logging/logging', () => ({
  getLogging: () => mockApi,
}));

import { getLoggings } from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getLoggings', () => {
  it('normaliza os params de paginação e devolve envelope de sucesso', async () => {
    mockApi.loggingControllerFindAll.mockResolvedValue([{ id: 'l1' }]);

    const result = await getLoggings({ page: 1, limit: 10 });

    expect(mockApi.loggingControllerFindAll).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10 }));
    expect(result).toMatchObject({ success: true, data: [{ id: 'l1' }] });
  });

  it('sem params: chama a API com undefined', async () => {
    mockApi.loggingControllerFindAll.mockResolvedValue([]);

    await getLoggings();

    expect(mockApi.loggingControllerFindAll).toHaveBeenCalledWith(undefined);
  });

  it('propaga falha como envelope de erro', async () => {
    mockApi.loggingControllerFindAll.mockRejectedValue({ response: { status: 500, data: { message: 'falhou' } } });

    const result = await getLoggings();

    expect(result.success).toBe(false);
    expect(result.message).toBe('falhou');
  });
});
