import { ForbiddenException } from '@nestjs/common';

export function assertOwnershipOrRole(
  currentUserId: string,
  resourceOwnerId: string,
  userRoleName: string,
  allowedRoles: string[] = ['ADMIN'],
): void {
  if (currentUserId === resourceOwnerId) return;
  if (allowedRoles.includes(userRoleName)) return;
  throw new ForbiddenException('common.errors.forbidden');
}
