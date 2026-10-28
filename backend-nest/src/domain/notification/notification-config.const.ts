/** Chaves em SystemConfiguration que ligam/desligam o relay de notificação por canal. */
export const notificationConfigKeys = {
  emailEnabled: 'SYSTEM_NOTIFICATION_EMAIL_ENABLED',
  whatsappEnabled: 'SYSTEM_NOTIFICATION_WHATSAPP_ENABLED',
} as const;

/** MessagingTemplate.key usado por toda notificação via notify() com channels.whatsapp. */
export const NOTIFICATION_WHATSAPP_TEMPLATE_KEY = 'NOTIFICATION';

export const NOTIFICATION_EMAIL_CAPABILITY = 'NOTIFICATION_EMAIL';
export const NOTIFICATION_WHATSAPP_CAPABILITY = 'NOTIFICATION_WHATSAPP';

/** Chaves de UserConfigurationDefinition: preferência de canal por usuário. */
export const notificationUserConfigKeys = {
  channelEmail: 'NOTIFICATION_CHANNEL_EMAIL',
  channelWhatsapp: 'NOTIFICATION_CHANNEL_WHATSAPP',
  mutedTypes: 'NOTIFICATION_MUTED_TYPES',
} as const;
