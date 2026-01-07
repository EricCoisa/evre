"use server";
import { DELETE, GET, POST, ApiResponse } from '../../api/api';
import type { 
  UserConfiguration,
} from './types';

// Obter todas as configurações do usuário logado
export async function getUserConfigurations(): Promise<ApiResponse<UserConfiguration[]>> {
  return await GET<UserConfiguration[]>('/user-configuration/me');
}

// Obter configuração específica por labelKey
export async function getUserConfigurationByLabelKey<T>(labelKey: string): Promise<ApiResponse<UserConfiguration<T> | null>> {
  return await GET<UserConfiguration<T>>(`/user-configuration/key/${labelKey}`);
}

// Definir/atualizar configuração do usuário
export async function setUserConfiguration<T>(
  definitionId: string, 
  value: T
): Promise<ApiResponse<UserConfiguration<T>>> {
  return await POST<UserConfiguration<T>>('/user-configuration/me', {
    definitionId,
    value: String(value), // Backend espera string
  });
}

// Resetar configuração específica (volta ao padrão)
export async function resetUserConfiguration(definitionId: string): Promise<ApiResponse<void>> {
  return await DELETE(`/user-configuration/me/${definitionId}`);
}