"use server";
// Thin adapter — wraps generated system-configuration functions
import { getSystemConfiguration as createSysConfigClient } from "@/lib/generated/system-configuration/system-configuration";
import type { ApiResponse } from "@/lib/api/api";
import type { SystemConfiguration } from "./types";
import { wrapAs } from "../wrap";

const api = createSysConfigClient();

export interface RoleOption {
  value: string;
  label: string;
}

export async function getSystemConfiguration<T>(
  labelKey: string,
): Promise<ApiResponse<SystemConfiguration<T>>> {
  return wrapAs(() =>
    api.systemConfigurationControllerFindByLabelKey(labelKey),
  );
}

export async function getSignupConfiguration(): Promise<
  ApiResponse<SystemConfiguration<boolean>>
> {
  return wrapAs(() =>
    api.systemConfigurationControllerFindSignupConfiguration(),
  );
}

// customInstance direto (não o client Orval): endpoint novo, gerador ainda não roda neste ambiente.
export async function getDefaultThemeConfiguration(): Promise<
  ApiResponse<SystemConfiguration<string>>
> {
  return wrapAs(() =>
    api.systemConfigurationControllerFindDefaultThemeConfiguration(),
  );
}

export async function updateSystemConfiguration<T>(
  id: string,
  value: T,
): Promise<ApiResponse<SystemConfiguration<T>>> {
  return wrapAs(() =>
    api.systemConfigurationControllerUpdate(id, { value: value as string }),
  );
}
