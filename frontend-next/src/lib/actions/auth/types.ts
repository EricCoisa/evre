/**
 * Tipos relacionados à autenticação
 */

import { Role } from "@/types/roles";

export interface UserRoute {
  id: string;
  path: string;
  labelKey: string;
  icon?: string | null;
  parentId: string | null;
  ordem: number;
  isHome: boolean;
  isActive: boolean;
  showSideBar: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  name?: string | null;
  image?: string | null; //Não implementado no backend ainda
  companyId?: string | null;
  routes: UserRoute[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
}

export interface RefreshResponse {
  access_token: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Tipo padrão de erro retornado pela API NestJS
 */
export interface ApiErrorResponse {
  statusCode: number;
  timestamp?: string;
  path?: string;
  message: string | string[] | {
    message: string | string[];
    error: string;
    statusCode: number;
  };
  error?: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  password: string;
}

export interface ResetPasswordResponse {
 message: string;
}