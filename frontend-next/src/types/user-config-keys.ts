/** Chaves de UserConfiguration que a aplicação conhece pelo nome. */
export const USER_CONFIG_KEYS = {
  language: 'USERCONFIG_LANGUAGE',
  theme: 'USERCONFIG_THEME',
  notificationChannelEmail: 'NOTIFICATION_CHANNEL_EMAIL',
  notificationChannelWhatsapp: 'NOTIFICATION_CHANNEL_WHATSAPP',
  notificationMutedTypes: 'NOTIFICATION_MUTED_TYPES',
} as const;

export type UserConfigKey = (typeof USER_CONFIG_KEYS)[keyof typeof USER_CONFIG_KEYS];
