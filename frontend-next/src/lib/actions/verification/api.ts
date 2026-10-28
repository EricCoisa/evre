"use server";
// Mecanismo genérico — qualquer módulo pede/confirma um código pelo mesmo par de rotas.
// customInstance direto (não Orval): gerador quebrado neste ambiente (orval 7.21.0 x Node 22).
import type { ApiResponse } from '@/lib/api/api';
import { customInstance } from '@/lib/api/orval-instance';
import { API_PATHS } from '@/lib/generated/paths';
import { wrap } from '../wrap';
import type {
  RequestVerificationInput,
  ConfirmVerificationInput,
  VerificationRequestResult,
  VerificationChannel,
  VerificationChannelHealth,
} from './types';

export async function requestVerification(
  input: RequestVerificationInput,
): Promise<ApiResponse<VerificationRequestResult>> {
  return wrap(() =>
    customInstance<VerificationRequestResult>({
      url: API_PATHS.VERIFICATION_REQUEST,
      method: 'POST',
      data: input,
    }),
  );
}

export async function confirmVerification(
  input: ConfirmVerificationInput,
): Promise<ApiResponse<void>> {
  return wrap(() =>
    customInstance<void>({
      url: API_PATHS.VERIFICATION_CONFIRM,
      method: 'POST',
      data: input,
    }),
  );
}

export async function getVerificationChannelHealth(
  channel: VerificationChannel,
): Promise<ApiResponse<VerificationChannelHealth>> {
  return wrap(() =>
    customInstance<VerificationChannelHealth>({
      url: API_PATHS.VERIFICATION_HEALTH,
      method: 'GET',
      params: { channel },
    }),
  );
}
