/** Chaves em SystemConfiguration que ligam/desligam o relay de notificação por canal. */
export const notificationConfigKeys = {
  emailEnabled: 'SYSTEM_NOTIFICATION_EMAIL_ENABLED',
  whatsappEnabled: 'SYSTEM_NOTIFICATION_WHATSAPP_ENABLED',
} as const;

/** MessagingTemplate.key usado por toda notificação via notify() com channels.whatsapp (sem link). */
export const NOTIFICATION_WHATSAPP_TEMPLATE_KEY = 'NOTIFICATION';

/** MessagingTemplate.key usado quando a notificação tem actionUrl — encurta o link e adiciona botão CTA. */
export const NOTIFICATION_WHATSAPP_CTA_TEMPLATE_KEY = 'NOTIFICATION_CTA';

export const NOTIFICATION_EMAIL_CAPABILITY = 'NOTIFICATION_EMAIL';
export const NOTIFICATION_WHATSAPP_CAPABILITY = 'NOTIFICATION_WHATSAPP';

/** Chaves de UserConfigurationDefinition: preferência de canal por usuário. */
export const notificationUserConfigKeys = {
  channelEmail: 'NOTIFICATION_CHANNEL_EMAIL',
  channelWhatsapp: 'NOTIFICATION_CHANNEL_WHATSAPP',
  mutedTypes: 'NOTIFICATION_MUTED_TYPES',
} as const;
