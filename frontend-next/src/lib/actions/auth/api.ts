"use server";
import { getAuth } from "@/lib/generated/auth/auth";
import type { SaveOauthConfigDto } from "@/lib/generated/schemas";
import { wrapAs } from "../wrap";
import type { ApiResponse } from "../../api/api";
import { captchaHeader } from "../../api/captcha-header";
import type {
  AuthUser,
  ForgotPasswordDto,
  OAuthProvider,
  ResetPasswordDto,
  ResetPasswordResponse,
  SaveOAuthConfigPayload,
  UserProfile,
} from "@/lib/actions/auth/types";

/** Sessão + menu. Não traz name/status/imageUrl — para isso use getProfile(). */
const api = getAuth();

export async function getCurrentUser(): Promise<ApiResponse<AuthUser>> {
  return wrapAs(() => api.authControllerGetMe());
}

export async function getProfile(): Promise<ApiResponse<UserProfile>> {
  const user = await wrapAs<UserProfile>(() => api.authControllerGetUser());
  if (!user.success) return user;
  // imageUrl is now returned directly from the API
  user.data.image = user.data.imageUrl ?? null;
  return user;
}

export async function forgotPassword(
  data: ForgotPasswordDto,
  captchaToken?: string | null,
): Promise<ApiResponse<true>> {
  return wrapAs(() =>
    api.authControllerForgotPassword(data, {
      headers: captchaHeader(captchaToken),
    }),
  );
}

export async function resetPassword(
  data: ResetPasswordDto,
  captchaToken?: string | null,
): Promise<ApiResponse<ResetPasswordResponse>> {
  return wrapAs(() =>
    api.authControllerResetPassword(data, {
      headers: captchaHeader(captchaToken),
    }),
  );
}

export async function checkResetToken(
  token: string,
): Promise<ApiResponse<{ valid: boolean }>> {
  return wrapAs(() => api.authControllerCheckResetToken({ token }));
}

/** Providers OAuth registrados, cada um com `configured`; 404 quando `OAUTH_LOGIN` está desligada. */
export async function getOAuthProviders(): Promise<
  ApiResponse<OAuthProvider[]>
> {
  return wrapAs(() => api.authControllerOauthProviders());
}

/** Credenciais de um provider, validadas por OIDC Discovery antes de gravar; secret vazio mantém o gravado. */
export async function saveOAuthConfig(
  provider: string,
  payload: SaveOAuthConfigPayload,
): Promise<ApiResponse<{ status: boolean; data: string }>> {
  return wrapAs(() =>
    api.authControllerSaveOauthConfig(provider, payload as SaveOauthConfigDto),
  );
}

export async function getForgotPasswordStatus(): Promise<
  ApiResponse<{ available: boolean }>
> {
  return wrapAs(() => api.authControllerForgotPasswordStatus());
}
