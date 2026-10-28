import { describe, it, expect } from 'vitest';
import { PaginationQuerySchema } from './pagination.schema';

describe('PaginationQuerySchema', () => {
  it('ausência de params usa os defaults', () => {
    const result = PaginationQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it('limit=0 clampa para 1 em vez de rejeitar', () => {
    const result = PaginationQuerySchema.parse({ limit: '0' });
    expect(result.limit).toBe(1);
  });

  it('limit=999 clampa para 50', () => {
    const result = PaginationQuerySchema.parse({ limit: '999' });
    expect(result.limit).toBe(50);
  });

  it('limit não-numérico cai no default 10', () => {
    const result = PaginationQuerySchema.parse({ limit: 'abc' });
    expect(result.limit).toBe(10);
  });

  it("limit='' cai no default 10, não no mínimo 1", () => {
    const result = PaginationQuerySchema.parse({ limit: '' });
    expect(result.limit).toBe(10);
  });

  it('page=0 clampa para 1', () => {
    const result = PaginationQuerySchema.parse({ page: '0' });
    expect(result.page).toBe(1);
  });

  it("page='' cai no default 1", () => {
    const result = PaginationQuerySchema.parse({ page: '' });
    expect(result.page).toBe(1);
  });

  it('page não-numérico cai no default 1', () => {
    const result = PaginationQuerySchema.parse({ page: 'abc' });
    expect(result.page).toBe(1);
  });
});
