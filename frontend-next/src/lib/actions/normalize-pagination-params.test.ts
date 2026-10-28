import { describe, it, expect } from 'vitest';
import { normalizePaginationParams } from './normalize-pagination-params';

describe('normalizePaginationParams', () => {
  it('retorna undefined quando params não é fornecido', () => {
    expect(normalizePaginationParams(undefined)).toBeUndefined();
  });

  it('preserva filtros quando passados como string JSON', () => {
    const params = {
      page: 1,
      limit: 10,
      pagination: true,
      filter: JSON.stringify({ role: 'USER' }),
    };

    const result = normalizePaginationParams(params);
    expect(result).toEqual({
      page: 1,
      limit: 10,
      pagination: true,
      search: undefined,
      filter: '{"role":"USER"}',
    });
  });

  it('serializa filtros para JSON quando passados como objeto Record', () => {
    const params = {
      page: 2,
      limit: 20,
      pagination: true,
      filter: { role: 'ADMIN', status: 'ACTIVE' },
    };

    const result = normalizePaginationParams(params);
    expect(result).toEqual({
      page: 2,
      limit: 20,
      pagination: true,
      search: undefined,
      filter: '{"role":"ADMIN","status":"ACTIVE"}',
    });
  });

  it('omite o filtro quando não fornecido, vazio ou string em branco', () => {
    expect(normalizePaginationParams({ page: 1, limit: 10, pagination: true })).toEqual({
      page: 1,
      limit: 10,
      pagination: true,
      search: undefined,
    });

    expect(normalizePaginationParams({ page: 1, limit: 10, pagination: true, filter: {} })).toEqual({
      page: 1,
      limit: 10,
      pagination: true,
      search: undefined,
    });

    expect(normalizePaginationParams({ page: 1, limit: 10, pagination: true, filter: '   ' })).toEqual({
      page: 1,
      limit: 10,
      pagination: true,
      search: undefined,
    });
  });
});

