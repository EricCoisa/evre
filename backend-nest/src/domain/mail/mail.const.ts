export const EmailProviderConst = {
  RESEND: 'RESEND',
  SMTP: 'SMTP',
};
export type EmailProvider = keyof typeof EmailProviderConst;
export type EmailProviderValue =
  (typeof EmailProviderConst)[keyof typeof EmailProviderConst];
