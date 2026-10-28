"use server";
// Thin adapter — delegates to Orval-generated client, wraps in ApiResponse for backward compat
import type { ApiResponse } from "../../api/api";
import type { PaginationParams } from "@/lib/types/pagination.types";
import { getUser as getUserFactory } from "@/lib/generated/user/user";
import type {
  UserDto as User,
  UpdateUserDto,
  UserControllerFindAllParams,
} from "@/lib/generated/schemas";
import type { PaginatedResponse } from "@/lib/types/pagination.types";
import { normalizePaginationParams } from "../normalize-pagination-params";
import type {
  ValidateInviteResponse,
  CreateUserDto,
  CreateInviteDto,
  UpdateProfileDto,
  UpdatePasswordDto,
  RouteWithUserAccess,
  Invite,
} from "./types";
import { customInstance } from "@/lib/api/orval-instance";
import { captchaHeader } from "@/lib/api/captcha-header";
import { API_PATHS } from "@/lib/generated/paths";
import { getAuth } from "@/lib/generated/auth/auth";
import { wrap, wrapAs } from "../wrap";

export interface RoleOption {
  value: string;
  label: string;
}

const api = getUserFactory();

export async function getUsers(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<User> | User[]>> {
  return wrapAs(() =>
    api.userControllerFindAll(
      normalizePaginationParams<UserControllerFindAllParams>(params),
    ),
  );
}

export async function getUser(id: string): Promise<ApiResponse<User>> {
  return wrapAs(() => api.userControllerGetById(id));
}

export interface SignupResult {
  accountCreated: boolean;
  user?: User;
}

export async function signUp(
  data: {
    email: string;
    password?: string;
    name?: string;
    inviteToken?: string;
    acceptTerms?: boolean;
  },
  captchaToken?: string | null,
): Promise<ApiResponse<SignupResult>> {
  return wrap(
    () =>
      api.userControllerSignup(data as never, {
        headers: captchaHeader(captchaToken),
      }) as unknown as Promise<SignupResult>,
  );
}

export async function completeEmailSignup(
  data: { token: string; password: string; acceptTerms: true },
  captchaToken?: string | null,
): Promise<ApiResponse<SignupResult>> {
  return wrap(() =>
    customInstance<SignupResult>({
      url: API_PATHS.USER_SIGNUP_CONFIRM,
      method: "POST",
      data,
      headers: captchaHeader(captchaToken),
    }),
  );
}

export async function getRoles(): Promise<ApiResponse<RoleOption[]>> {
  return wrap(() => api.userControllerGetRoles());
}

export async function getStatus(): Promise<ApiResponse<RoleOption[]>> {
  return wrap(() => api.userControllerGetStatus());
}

export async function updateUser(
  id: string,
  data: UpdateUserDto,
): Promise<ApiResponse<User>> {
  return wrap(
    () => api.userControllerUpdate(id, data) as unknown as Promise<User>,
  );
}

export async function updateProfile(
  id: string,
  data: UpdateProfileDto,
): Promise<ApiResponse<User>> {
  if (data.image) {
    const formData = new FormData();
    if (data.name !== undefined) formData.append("name", data.name);
    if (data.phone !== undefined) formData.append("phone", data.phone);
    formData.append("image", data.image);
    return wrap(() =>
      customInstance<User>({
        url: API_PATHS.USER_BY_ID_PROFILE(id),
        method: "PATCH",
        data: formData,
      }),
    );
  }
  return wrap(
    () =>
      api.userControllerUpdateProfile(id, {
        name: data.name,
        phone: data.phone,
      }) as unknown as Promise<User>,
  );
}

export async function updatePassword(
  id: string,
  data: UpdatePasswordDto,
): Promise<ApiResponse<User>> {
  return wrap(
    () =>
      api.userControllerUpdatePassword(
        id,
        data as never,
      ) as unknown as Promise<User>,
  );
}

export async function getUserRoutes(
  userId: string,
  params?: PaginationParams,
): Promise<ApiResponse<unknown>> {
  return wrap(() =>
    api.userControllerGetUserRoutes(userId, normalizePaginationParams(params)),
  );
}

export async function getUserRoutesManagement(
  userId: string,
  params?: PaginationParams,
): Promise<
  ApiResponse<PaginatedResponse<RouteWithUserAccess> | RouteWithUserAccess[]>
> {
  // Orval doesn't generate response type for this endpoint; cast to expected shape
  return wrap(
    () =>
      api.userControllerGetUserRoutesManagement(
        userId,
        normalizePaginationParams(params),
      ) as unknown as Promise<
        PaginatedResponse<RouteWithUserAccess> | RouteWithUserAccess[]
      >,
  );
}

export async function exportMyData(): Promise<ApiResponse<Blob | null>> {
  return wrap(async () => {
    const json = await api.userControllerExportMyData();
    return new Blob([JSON.stringify(json)], { type: "application/json" });
  });
}

export async function deleteMyAccount(
  password: string,
): Promise<ApiResponse<void>> {
  return wrap(() => api.userControllerDeleteMyAccount({ password }));
}

export async function deleteUser(id: string): Promise<ApiResponse<void>> {
  return wrap(
    () => api.userControllerRemoveUser(id) as unknown as Promise<void>,
  );
}

const authApi = getAuth();

export async function createUser(
  data: CreateUserDto,
): Promise<ApiResponse<{ user: User }>> {
  return wrap(
    () =>
      authApi.authControllerRegister(data as never) as unknown as Promise<{
        user: User;
      }>,
  );
}

export async function createInvite(
  data: CreateInviteDto,
): Promise<ApiResponse<{ actionUrl: string }>> {
  return wrap(
    () =>
      authApi.authControllerGenerateInviteToken(
        data as never,
      ) as unknown as Promise<{ actionUrl: string }>,
  );
}

export async function validateInvite(
  token: string,
): Promise<ApiResponse<ValidateInviteResponse>> {
  return wrap(
    () =>
      authApi.authControllerValidateInviteToken({
        token,
      }) as unknown as Promise<ValidateInviteResponse>,
  );
}

/** Aceita o convite de um usuário que já tem conta, trocando sua role. */
export async function acceptInvite(
  token: string,
  captchaToken?: string | null,
): Promise<ApiResponse<{ created: string }>> {
  return wrap(
    () =>
      authApi.authControllerAcceptInvite({ token } as never, {
        headers: captchaHeader(captchaToken),
      }) as unknown as Promise<{ created: string }>,
  );
}

export async function getInvites(): Promise<ApiResponse<Invite[]>> {
  return wrap(
    () => authApi.authControllerGetInvites() as unknown as Promise<Invite[]>,
  );
}

export async function deleteInvite(id: string): Promise<ApiResponse<void>> {
  return wrap(
    () => authApi.authControllerDeleteInvite(id) as unknown as Promise<void>,
  );
}
