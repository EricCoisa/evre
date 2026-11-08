/** Chaves de SystemConfiguration que a aplicação conhece pelo nome. */
export const SYSTEM_CONFIG_KEYS = {
  captchaEnabled: 'SYSTEM_CAPTCHA_ENABLED',
  notificationEmailEnabled: 'SYSTEM_NOTIFICATION_EMAIL_ENABLED',
  notificationWhatsappEnabled: 'SYSTEM_NOTIFICATION_WHATSAPP_ENABLED',
  logMinLevel: 'SYSTEM_LOG_MIN_LEVEL',
  logLimite: 'SYSTEMCONFIG_LOG_LIMITE',
  logDeleteDay: 'SYSTEMCONFIG_LOG_DELETE_DAY',
  theme: 'SYSTEMCONFIG_THEME',
  userCreate: 'SYSTEM_USER_CREATE',
  aiSystemPrompt: 'SYSTEM_AI_SYSTEM_PROMPT',
  agentOwnKey: 'SYSTEM_AGENT_OWN_KEY',
  timeTrackingForgottenThresholdHours: 'TIME_TRACKING_FORGOTTEN_THRESHOLD_HOURS',
} as const;

export type SystemConfigKey = (typeof SYSTEM_CONFIG_KEYS)[keyof typeof SYSTEM_CONFIG_KEYS];
