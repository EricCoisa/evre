"use server";
import { getCaptcha } from '@/lib/generated/captcha/captcha';
import type {
  CaptchaConfigDto,
  CaptchaProviderDto,
  SaveCaptchaConfigDto,
} from '@/lib/generated/schemas';
import { wrap } from '../wrap';
import type { ApiResponse } from '../../api/api';

const api = getCaptcha();

/** Retorna o provider e site key de captcha configurados, para a tela de login. */
export async function getCaptchaConfig(): Promise<ApiResponse<CaptchaConfigDto>> {
  return wrap(() => api.captchaControllerConfig());
}

/** Catálogo para a tela de configuração (ADMIN). Traz o `scriptUrl` de cada um. */
export async function getCaptchaProviders(): Promise<ApiResponse<CaptchaProviderDto[]>> {
  return wrap(() => api.captchaControllerProviders());
}

/** Valida as credenciais do captcha no provider e grava a configuração. */
export async function saveCaptchaConfig(
  payload: SaveCaptchaConfigDto,
): Promise<ApiResponse<void>> {
  return wrap(() => api.captchaControllerSaveConfig(payload));
}
