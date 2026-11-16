export const EmailTemplateType = {
  INVITATION: 'INVITATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
  NOTIFICATION: 'NOTIFICATION',
  VERIFICATION_CODE: 'VERIFICATION_CODE',
  /** Signup orgânico com confirmação exigida — mesmo mecanismo do convite, copy própria (não é um convite de alguém). */
  SIGNUP_WELCOME: 'SIGNUP_WELCOME',
  /** Template livre para o operador enviar manualmente a um lead/contato. */
  LEAD_FOLLOWUP: 'LEAD_FOLLOWUP',
} as const;

export type EmailTemplateType =
  (typeof EmailTemplateType)[keyof typeof EmailTemplateType];

export const EMAIL_TEMPLATE_TYPES: readonly EmailTemplateType[] =
  Object.values(EmailTemplateType);

export const EMAIL_TEMPLATE_FILES: Record<EmailTemplateType, string> = {
  INVITATION: 'invitation.html',
  PASSWORD_RESET: 'password-reset.html',
  NOTIFICATION: 'notification.html',
  VERIFICATION_CODE: 'verification-code.html',
  SIGNUP_WELCOME: 'signup-welcome.html',
  LEAD_FOLLOWUP: 'lead-followup.html',
};

export const EMAIL_TEMPLATES_CONFIG_KEY = 'EMAIL_TEMPLATES';

export const EMAIL_CAPABILITY = 'EMAIL';
