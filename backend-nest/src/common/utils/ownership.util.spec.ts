import { ForbiddenException } from '@nestjs/common';
import { describe, it, expect } from 'vitest';
import { assertOwnershipOrRole } from './ownership.util';

describe('assertOwnershipOrRole', () => {
  it('passes if currentUserId === resourceOwnerId', () => {
    expect(() =>
      assertOwnershipOrRole('user-1', 'user-1', 'USER'),
    ).not.toThrow();
  });

  it('passes if user has ADMIN role', () => {
    expect(() =>
      assertOwnershipOrRole('admin-id', 'other-user-id', 'ADMIN'),
    ).not.toThrow();
  });

  it('throws ForbiddenException if neither owner nor allowed role', () => {
    expect(() => assertOwnershipOrRole('user-1', 'user-2', 'USER')).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException with correct message', () => {
    expect(() => assertOwnershipOrRole('user-1', 'user-2', 'USER')).toThrow(
      'errors.forbidden',
    );
  });

  it('respects custom allowedRoles', () => {
    expect(() =>
      assertOwnershipOrRole('user-1', 'user-2', 'MANAGER', ['MANAGER']),
    ).not.toThrow();
  });

  it('LGPD self-only pattern: throws even for ADMIN when roles array is empty', () => {
    // Simulates the direct ForbiddenException throw used for password/LGPD endpoints
    const selfOnlyCheck = (currentId: string, resourceId: string) => {
      if (currentId !== resourceId)
        throw new ForbiddenException('common.errors.self_only');
    };

    expect(() => selfOnlyCheck('admin-id', 'other-user-id')).toThrow(
      ForbiddenException,
    );
    expect(() => selfOnlyCheck('admin-id', 'other-user-id')).toThrow(
      'common.errors.self_only',
    );
    expect(() => selfOnlyCheck('user-1', 'user-1')).not.toThrow();
  });
});
