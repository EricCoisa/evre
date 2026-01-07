import { Role } from "@/types/roles";

export interface RoleUser {
  roleId: Role;
}

export interface Route {
  id: string;
  path: string;
  labelKey: string;
  icon: string | null;
}

export interface RoleUserAccess {
  id: string;
  roleId: Role;
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