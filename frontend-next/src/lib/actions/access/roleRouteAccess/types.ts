// Re-export from generated schemas; local aliases for backward compat
import type { Role } from '@/types/roles';

export type { RoleRouteAccessDto as RoleRouteAccess } from '@/lib/generated/schemas';

// RoleUser and RoleUserAccess kept as-is (use local Role type not in openapi)
export interface RoleUser {
  roleId: string;
  roleName: Role;
}

export interface Route {
  id: string;
  path: string;
  labelKey: string;
  icon: string | null;
}

export interface RoleUserAccess {
  id: string;
  roleId: string;
  routeId: string;
  path: string;
  labelKey: string;
  icon: string | null;
  isActive: boolean;
  hasAccess: boolean;
  route?: Route;
  createdAt: string;
  updatedAt: string;
}
