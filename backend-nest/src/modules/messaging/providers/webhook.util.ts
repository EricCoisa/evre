import { timingSafeEqual } from 'crypto';
import {
  MessagingMessageTypeConst,
  MessagingStatusConst,
  MessagingTemplateApprovalConst,
  type MessagingStatus,
  type MessagingStoredType,
  type MessagingTemplateApproval,
} from 'src/domain/messaging/messaging.const';

/** Comparação de segredo em tempo constante; tolera tamanhos diferentes sem lançar. */
export function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a ?? '', 'utf8');
  const bufB = Buffer.from(b ?? '', 'utf8');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Campo de payload não confiável para string; objeto vira '' em vez de '[object Object]'. */
export function asText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '';
}

/** Timestamp de provider (segundos, ms ou ISO) para Date; inválido vira agora. */
export function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    return new Date(value > 1e12 ? value : value * 1000);
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && value.trim() !== '') {
      return new Date(numeric > 1e12 ? numeric : numeric * 1000);
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/** Vocabulário de status da Evolution API (Baileys). Desconhecido é ignorado, não adivinhado. */
export const EVOLUTION_STATUS: Record<string, MessagingStatus | undefined> = {
  PENDING: MessagingStatusConst.SENT,
  SERVER_ACK: MessagingStatusConst.SENT,
  DELIVERY_ACK: MessagingStatusConst.DELIVERED,
  READ: MessagingStatusConst.READ,
  PLAYED: MessagingStatusConst.READ,
  ERROR: MessagingStatusConst.FAILED,
};

/** Vocabulário da Meta Cloud API. */
export const META_STATUS: Record<string, MessagingStatus | undefined> = {
  sent: MessagingStatusConst.SENT,
  delivered: MessagingStatusConst.DELIVERED,
  read: MessagingStatusConst.READ,
  failed: MessagingStatusConst.FAILED,
};

/** Vocabulário de `message_template_status_update` da WABA. Desconhecido é ignorado, não adivinhado. */
export const META_TEMPLATE_STATUS: Record<
  string,
  MessagingTemplateApproval | undefined
> = {
  APPROVED: MessagingTemplateApprovalConst.APPROVED,
  REJECTED: MessagingTemplateApprovalConst.REJECTED,
  PAUSED: MessagingTemplateApprovalConst.PAUSED,
  PENDING_DELETION: MessagingTemplateApprovalConst.DISABLED,
  DISABLED: MessagingTemplateApprovalConst.DISABLED,
  IN_APPEAL: MessagingTemplateApprovalConst.PENDING,
  PENDING: MessagingTemplateApprovalConst.PENDING,
};

/** Vocabulário do Evolution Go (evento Receipt). */
/** Chaves do `state` do Receipt do Evolution Go, em minúsculas. */
export const EVOLUTION_GO_STATUS: Record<string, MessagingStatus | undefined> =
  {
    delivered: MessagingStatusConst.DELIVERED,
    read: MessagingStatusConst.READ,
    readself: MessagingStatusConst.READ,
    'read-self': MessagingStatusConst.READ,
    played: MessagingStatusConst.READ,
  };

export interface ParsedBaileysMessage {
  type: MessagingStoredType;
  text?: string;
  mimeType?: string;
  fileName?: string;
}

const BAILEYS_MEDIA_KEYS: Record<string, MessagingStoredType> = {
  imageMessage: MessagingMessageTypeConst.IMAGE,
  videoMessage: MessagingMessageTypeConst.VIDEO,
  documentMessage: MessagingMessageTypeConst.DOCUMENT,
  audioMessage: MessagingMessageTypeConst.AUDIO,
  stickerMessage: MessagingMessageTypeConst.STICKER,
};

/** Envelopes que só embrulham a mensagem real (efêmera, visualização única, documento com legenda). */
const BAILEYS_WRAPPERS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'documentWithCaptionMessage',
];

/** Eventos do protocolo que não são conteúdo de conversa: reação, edição/revogação, chaves. */
const BAILEYS_IGNORED_KEYS = [
  'reactionMessage',
  'protocolMessage',
  'senderKeyDistributionMessage',
  'messageContextInfo',
];

function unwrapBaileys(
  message: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of BAILEYS_WRAPPERS) {
    const inner = (
      message[key] as { message?: Record<string, unknown> } | undefined
    )?.message;
    if (inner) return unwrapBaileys(inner);
  }
  return message;
}

/** Lê o objeto `message` no formato Baileys/whatsmeow e devolve `null` se não for conteúdo de conversa. */
export function parseBaileysMessage(
  raw: Record<string, unknown> | undefined,
): ParsedBaileysMessage | null {
  if (!raw) return { type: MessagingMessageTypeConst.UNSUPPORTED };
  const message = unwrapBaileys(raw);

  const text =
    (message.conversation as string | undefined) ??
    (message.extendedTextMessage as { text?: string } | undefined)?.text;
  if (text !== undefined) return { type: MessagingMessageTypeConst.TEXT, text };

  for (const [key, type] of Object.entries(BAILEYS_MEDIA_KEYS)) {
    const media = message[key] as
      { caption?: string; mimetype?: string; fileName?: string } | undefined;
    if (!media) continue;
    return {
      type,
      text: media.caption,
      mimeType: media.mimetype,
      fileName: media.fileName,
    };
  }

  if (BAILEYS_IGNORED_KEYS.some((key) => key in message)) return null;
  return { type: MessagingMessageTypeConst.UNSUPPORTED };
}
