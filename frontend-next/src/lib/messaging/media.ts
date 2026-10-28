import { API_PATHS } from '@/lib/generated/paths';
import type { MessagingMessage } from '@/lib/actions/messaging/types';

/** Monta a URL de mídia servida pelo proxy do front, que repassa ao backend com o token. */
export const MESSAGES_PROXY_PATH = `/api${API_PATHS.MESSAGING_MESSAGES}`;

export const MEDIA_MESSAGE_TYPES = ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'STICKER'] as const;
export type MediaMessageType = (typeof MEDIA_MESSAGE_TYPES)[number];

export function isMediaMessage(type: string): type is MediaMessageType {
  return (MEDIA_MESSAGE_TYPES as readonly string[]).includes(type);
}

/** Envio por link já tem a URL (o provider precisou alcançá-la); o resto vem pelo proxy. */
export function messageMediaSrc(message: Pick<MessagingMessage, 'id' | 'mediaUrl'>): string {
  return message.mediaUrl ?? `/api${API_PATHS.MESSAGING_MESSAGES_BY_ID_MEDIA(message.id)}`;
}

/** Teto de upload do backend (`MESSAGING_MAX_UPLOAD_BYTES`). */
export const MAX_ATTACHMENT_BYTES = 64 * 1024 * 1024;
