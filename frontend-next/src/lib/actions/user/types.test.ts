import { describe, it, expect } from 'vitest';
import { UserStatusColors } from './types';

// types.ts é majoritariamente `export type`/`export interface` (erasados em runtime);
// UserStatusColors é o único valor real exportado pelo módulo.
describe('UserStatusColors', () => {
  it('mapeia cada status conhecido para uma classe de badge', () => {
    expect(UserStatusColors).toEqual({
      ACTIVE: 'bg-green-100 text-green-800',
      INACTIVE: 'bg-gray-100 text-gray-800',
      SUSPENDED: 'bg-red-100 text-red-800',
    });
  });
});
