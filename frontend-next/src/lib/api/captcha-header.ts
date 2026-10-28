/** Espelha CAPTCHA_TOKEN_HEADER de backend-nest/src/domain/auth/captcha.const.ts. */
export const CAPTCHA_TOKEN_HEADER = 'x-captcha-token';

/** Monta o header com o token de captcha do widget, quando presente. */
export function captchaHeader(token?: string | null): Record<string, string> {
  return token ? { [CAPTCHA_TOKEN_HEADER]: token } : {};
}
