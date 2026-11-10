/** Capabilities que o frontend conhece pelo nome. Espelha os `register()` do backend. */
export const CAPABILITIES = {
  email: 'EMAIL',
  messaging: 'MESSAGING',
  captcha: 'CAPTCHA',
  notificationEmail: 'NOTIFICATION_EMAIL',
  notificationWhatsapp: 'NOTIFICATION_WHATSAPP',
  pdf: 'PDF',
} as const;

export type CapabilityKey = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

/** Mapeia cada capability para o path + tab onde o ADMIN deve resolvê-la. */
export const CAPABILITY_FIX_PATH: Record<string, string> = {
  [CAPABILITIES.captcha]: '/settings?tab=captchaConfig',
  [CAPABILITIES.email]: '/settings?tab=emailConfig',
  [CAPABILITIES.messaging]: '/settings?tab=messagingConfig',
  [CAPABILITIES.notificationEmail]: '/settings?tab=notificationConfig',
  [CAPABILITIES.notificationWhatsapp]: '/settings?tab=notificationConfig',
};

/** Espelha `RequirementsResult` do backend (modules/capability/resolve-requirements.util.ts).
 *  O Orval gera `requirements` como `{[key:string]: unknown}` (ApiProperty sem `type`
 *  estruturado) — os DTOs locais de system/user-configuration sobrescrevem o campo com este tipo. */
export interface ConfigurationRequirements {
  hidden: boolean;
  disabled: boolean;
  reason?: string;
  capability?: string;
}
