import { describe, it, expect } from 'vitest';
import { isRoleAllowedForRoute } from './route-roles.util';

describe('isRoleAllowedForRoute', () => {
  it('allows any role when allowedRoles is empty (sem teto)', () => {
    expect(isRoleAllowedForRoute([], 'USER')).toBe(true);
    expect(isRoleAllowedForRoute([], null)).toBe(true);
  });

  it('allows a role present in allowedRoles', () => {
    expect(isRoleAllowedForRoute(['ADMIN', 'MODERATOR'], 'MODERATOR')).toBe(true);
  });

  it('rejects a role outside allowedRoles', () => {
    expect(isRoleAllowedForRoute(['ADMIN', 'MODERATOR'], 'USER')).toBe(false);
  });

  it('rejects a missing role when allowedRoles is set', () => {
    expect(isRoleAllowedForRoute(['ADMIN'], null)).toBe(false);
    expect(isRoleAllowedForRoute(['ADMIN'], undefined)).toBe(false);
  });
});
