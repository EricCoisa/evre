/** Registro dos providers de captcha suportados. */
export const CaptchaProviders = {
  TURNSTILE: {
    label: 'Cloudflare Turnstile',
    verifyUrl: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    scriptUrl:
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
  },
  HCAPTCHA: {
    label: 'hCaptcha',
    verifyUrl: 'https://api.hcaptcha.com/siteverify',
    scriptUrl: 'https://js.hcaptcha.com/1/api.js?render=explicit',
  },
  RECAPTCHA_V3: {
    label: 'Google reCAPTCHA v3',
    verifyUrl: 'https://www.google.com/recaptcha/api/siteverify',
    // v3 carrega com o site key na própria URL; o front concatena.
    scriptUrl: 'https://www.google.com/recaptcha/api.js?render=',
    /** Score mínimo aceito; reCAPTCHA v3 aprova bot sem este piso. */
    minScore: 0.5,
  },
} as const;

export type CaptchaProviderId = keyof typeof CaptchaProviders;

export const CaptchaProviderIds = Object.keys(
  CaptchaProviders,
) as CaptchaProviderId[];

/** Chaves em SystemConfiguration que descrevem o captcha. */
export const captchaConfigKeys = {
  enabled: 'SYSTEM_CAPTCHA_ENABLED',
  provider: 'SYSTEM_CAPTCHA_PROVIDER',
  siteKey: 'SYSTEM_CAPTCHA_SITE_KEY',
  secretKey: 'SYSTEM_CAPTCHA_SECRET_KEY',
} as const;

/** Header onde o token do widget viaja do browser até aqui. */
export const CAPTCHA_TOKEN_HEADER = 'x-captcha-token';

export const CAPTCHA_CAPABILITY = 'CAPTCHA';
