import { describe, it, expect, vi } from 'vitest';
import { paginate } from './paginate.util';

const base = { page: 2, limit: 10, pagination: true, search: undefined, filter: undefined };

describe('paginate', () => {
  it('calcula skip/take e monta o meta', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'a' }]);
    const count = vi.fn().mockResolvedValue(25);

    const result = await paginate(base, { findMany, count });

    expect(findMany).toHaveBeenCalledWith({ skip: 10, take: 10 });
    expect(result).toEqual({
      data: [{ id: 'a' }],
      meta: { total: 25, page: 2, limit: 10, totalPages: 3 },
    });
  });

  it('sem paginação devolve array e não chama count', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const count = vi.fn();

    const result = await paginate({ ...base, pagination: false }, { findMany, count });

    expect(findMany).toHaveBeenCalledWith({});
    expect(count).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('aplica map nos dois caminhos', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'a' }]);
    const count = vi.fn().mockResolvedValue(1);
    const map = (r: { id: string }) => ({ key: r.id.toUpperCase() });

    await expect(paginate(base, { findMany, count, map })).resolves.toMatchObject({
      data: [{ key: 'A' }],
    });
    await expect(
      paginate({ ...base, pagination: false }, { findMany, count, map }),
    ).resolves.toEqual([{ key: 'A' }]);
  });

  it('inclui campos extras no envelope', async () => {
    const result = await paginate(base, {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      extra: { filter: { action: ['CREATE'] } },
    });
    expect(result).toHaveProperty('filter', { action: ['CREATE'] });
  });

  it('totalPages é 0 quando não há linhas', async () => {
    const result = (await paginate(base, {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    })) as { meta: { totalPages: number } };
    expect(result.meta.totalPages).toBe(0);
  });
});
