"use server";
import type { ApiResponse } from '../../api/api';
import { getEmail } from '@/lib/generated/email/email';
import type { EmailProviderResponse, EmailHealthStatus, EmailTemplateInfo, SaveEmailConfigPayload } from './types';
import { wrapAs } from '../wrap';

const api = getEmail();

/** Valida contra o provider e salva num passo só. */
export async function saveEmailConfiguration(
  payload: SaveEmailConfigPayload,
): Promise<ApiResponse<EmailProviderResponse>> {
  return wrapAs(() => api.emailControllerSaveConfiguration(payload));
}

export async function getEmailHealth(): Promise<ApiResponse<EmailHealthStatus>> {
  return wrapAs(() => api.emailControllerHealth());
}

export async function getEmailTemplates(): Promise<ApiResponse<EmailTemplateInfo[]>> {
  return wrapAs(() => api.emailControllerTemplates());
}
