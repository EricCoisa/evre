export const NOTIFICATION_DEBOUNCE_QUEUE = 'notification-debounce';
export const NOTIFICATION_DEBOUNCE_DELAY_MS = 30_000;

export interface NotificationDebounceJobData {
  bufferKey: string;
  recipientUserId: string;
  type: string;
  actionUrl?: string;
  channels?: { email?: boolean; whatsapp?: boolean };
  /** Chaves i18n; processor acrescenta `_plural` automaticamente quando há 2+ itens no buffer. */
  titleKey: string;
  messageKey: string;
}

export interface NotifyDebouncedInput extends NotificationDebounceJobData {
  delayMs: number;
  /** Rótulo deste evento individual (ex.: título da task). */
  item: string;
}
