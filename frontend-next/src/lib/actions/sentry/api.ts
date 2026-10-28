"use server";
import { getSentry } from '@/lib/generated/sentry/sentry';
import type { SaveSentryConfigDto } from '@/lib/generated/schemas';
import { wrap } from '../wrap';
import type { ApiResponse } from '../../api/api';

const api = getSentry();

/** Valida o DSN do Sentry e grava a configuração. */
export async function saveSentryConfig(
  payload: SaveSentryConfigDto,
): Promise<ApiResponse<void>> {
  return wrap(() => api.sentryConfigControllerSaveConfig(payload));
}
