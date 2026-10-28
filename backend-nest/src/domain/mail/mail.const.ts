export const EmailProviderConst = {
  RESEND: 'RESEND',
  SMTP: 'SMTP',
};
export type EmailProvider = keyof typeof EmailProviderConst;
export type EmailProviderValue =
  (typeof EmailProviderConst)[keyof typeof EmailProviderConst];

/** Chaves em SystemConfiguration que descrevem o provider de email. */
export const EMAIL_CONFIG_KEYS = {
  provider: 'SYSTEM_EMAIL_PROVIDER',
  providerApiKey: 'SYSTEM_EMAIL_PROVIDER_API_KEY',
  defaultFrom: 'SYSTEM_EMAIL_DEFAULT_FROM',
  smtpHost: 'SYSTEM_EMAIL_SMTP_HOST',
  smtpPort: 'SYSTEM_EMAIL_SMTP_PORT',
  smtpUser: 'SYSTEM_EMAIL_SMTP_USER',
  smtpPass: 'SYSTEM_EMAIL_SMTP_PASS',
  smtpSecure: 'SYSTEM_EMAIL_SMTP_SECURE',
} as const;
