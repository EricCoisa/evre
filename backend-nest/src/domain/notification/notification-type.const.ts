/** Catálogo de tipos de notificação por módulo, não um enum do banco; este módulo só define o mecanismo. */
export const NotificationType = {
  SYSTEM_ANNOUNCEMENT: 'SYSTEM_ANNOUNCEMENT',
} as const;

export type NotificationTypeKey =
  (typeof NotificationType)[keyof typeof NotificationType];
