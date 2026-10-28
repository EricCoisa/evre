import { describe, it, expect } from 'vitest';
import { PAGE_KEYS, describePages } from './pages';

describe('describePages', () => {
  it('lista toda PAGE_KEYS como { pageKey, description }', () => {
    const result = describePages();

    expect(result).toEqual(
      Object.entries(PAGE_KEYS).map(([pageKey, description]) => ({ pageKey, description })),
    );
  });

  it('inclui /dashboard com a descrição declarada', () => {
    const result = describePages();

    expect(result.find((p) => p.pageKey === '/dashboard')).toEqual({
      pageKey: '/dashboard',
      description: PAGE_KEYS['/dashboard'],
    });
  });
});
