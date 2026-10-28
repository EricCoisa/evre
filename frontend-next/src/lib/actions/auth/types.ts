/** Tipos relacionados à autenticação. */

import type { MeResponseDto } from '@/lib/generated/schemas/meResponseDto';
import type { RouteItemDto } from '@/lib/generated/schemas/routeItemDto';
import type { UserProfileResponseDto } from '@/lib/generated/schemas/userProfileResponseDto';

/** Item de menu — `GetUserRoutesUseCase` no backend. */
export type UserRoute = RouteItemDto;

/** `GET /auth/me` — sessão + menu, sem ir ao banco buscar o perfil. */
export type AuthUser = MeResponseDto;

/** `GET /auth/user` — perfil completo + menu. */
export type UserProfile = UserProfileResponseDto & {
  image?: string | null;
};

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

/** Envelope de erro da API, montado pelo `AllExceptionsFilter`; `message` já vem pronto para exibir. */
export interface ApiErrorResponse {
  statusCode: number;
  timestamp?: string;
  path?: string;
  message: string;
  /** Um item por campo — só presente em falha de validação. */
  errors?: { path: (string | number)[]; message: string }[];
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

/** Provider OAuth/OIDC registrado no backend — ver docs/backend/oauth.md. */
export interface OAuthProvider {
  id: string;
  label: string;
  configured: boolean;
  enabled: boolean;
}

/** Corpo de `PUT /auth/oauth/:provider/config`. Secret vazio = manter o gravado. */
export interface SaveOAuthConfigPayload {
  issuer: string;
  clientId: string;
  clientSecret?: string;
}
