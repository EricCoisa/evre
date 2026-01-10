import { Role } from "@/types/roles";
import { UserStatus } from "@/types/status";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInviteDto {
  email: string;
  role?: Role;
}

export interface CreateCompanyInviteDto {
  companyId: string;
  email: string;
  name?: string;
}

export interface ValidateInviteResponse {
 valid: boolean ; token: string; email: string
}


export interface SignUpDto {
  email: string;
  password: string;
  name?: string;
  inviteToken?: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  name?: string;
  role?: Role;
  status?: UserStatus;
}

export interface UpdateUserDto {
  email?: string;
  password?: string;
  name?: string;
  role?: Role;
  status?: UserStatus;
}

export type UpdateProfileDto = Omit<UpdateUserDto, 'email' | 'role' | 'status'> & {
  image?: File;
};

export type UpdatePasswordDto = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

export interface UserRouteAccess {
  id: string;
  userId: string;
  routeId: string;
  grantedBy: string | null;
  createdAt: string;
  route: {
    id: string;
    path: string;
    labelKey: string;
    isActive: boolean;
  };
}

export interface RouteWithUserAccess {
  id: string;
  path: string;
  labelKey: string;
  icon: string | null;
  isActive: boolean;
  hasAccess: boolean;
  accessInfo: {
    id: string;
    grantedBy: string | null;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface GrantUserRouteAccessResponse {
  id: string;
  userId: string;
  routeId: string;
  grantedBy: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  route: {
    id: string;
    path: string;
    labelKey: string;
  };
  grantedByUser: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

export interface RevokeUserRouteAccessResponse {
  message: string;
}

export const UserStatusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  SUSPENDED: 'bg-red-100 text-red-800',
};