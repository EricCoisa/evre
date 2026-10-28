export const MessagingProviderConst = {
  EVOLUTION_API: 'EVOLUTION_API',
  EVOLUTION_GO: 'EVOLUTION_GO',
  META: 'META',
} as const;
export type MessagingProvider =
  (typeof MessagingProviderConst)[keyof typeof MessagingProviderConst];

export const MESSAGING_MESSAGE_TYPES = [
  'TEXT',
  'IMAGE',
  'VIDEO',
  'DOCUMENT',
  'AUDIO',
  'TEMPLATE',
] as const;
export type MessagingMessageType = (typeof MESSAGING_MESSAGE_TYPES)[number];

/** Tipos que só existem no recebimento (o usuário não os envia): figurinha e o que não sabemos exibir. */
export const MESSAGING_INBOUND_ONLY_TYPES = ['STICKER', 'UNSUPPORTED'] as const;
export type MessagingStoredType =
  MessagingMessageType | (typeof MESSAGING_INBOUND_ONLY_TYPES)[number];

/** Tipos cujo conteúdo é um arquivo buscado no provider (`GET /messaging/messages/:id/media`). */
export const MESSAGING_MEDIA_TYPES = [
  'IMAGE',
  'VIDEO',
  'DOCUMENT',
  'AUDIO',
  'STICKER',
] as const satisfies readonly MessagingStoredType[];
export type MessagingMediaType = (typeof MESSAGING_MEDIA_TYPES)[number];

/** Tipo de mensagem de um arquivo anexado, como o WhatsApp Web: imagem, vídeo e áudio pelo mimetype; o resto vai como documento. */
export function typeFromMime(
  mimeType: string,
): Extract<MessagingMessageType, 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'> {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  return 'DOCUMENT';
}

/** Teto de upload de anexo (memória do processo): o maior limite do WhatsApp é o de documento, 100 MB. */
export const MESSAGING_MAX_UPLOAD_BYTES = 64 * 1024 * 1024;

export function isMediaType(type: string): type is MessagingMediaType {
  return (MESSAGING_MEDIA_TYPES as readonly string[]).includes(type);
}

/** Acesso nomeado (p.ex. `case MessagingMessageTypeConst.TEXT`) sem repetir os literais — derivado de `MESSAGING_MESSAGE_TYPES`. */
export const MessagingMessageTypeConst = Object.fromEntries(
  [...MESSAGING_MESSAGE_TYPES, ...MESSAGING_INBOUND_ONLY_TYPES].map((type) => [
    type,
    type,
  ]),
) as { [K in MessagingStoredType]: K };

export const MessagingStatusConst = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
} as const;
export type MessagingStatus =
  (typeof MessagingStatusConst)[keyof typeof MessagingStatusConst];

/** Ordem do menos para o mais avançado; webhook atrasado nunca rebaixa um status já mais avançado. */
const MESSAGING_STATUS_ORDER: readonly MessagingStatus[] = [
  MessagingStatusConst.QUEUED,
  MessagingStatusConst.SENT,
  MessagingStatusConst.FAILED,
  MessagingStatusConst.DELIVERED,
  MessagingStatusConst.READ,
];

/** Status que um evento de status pode sobrescrever: só os estritamente anteriores a ele. */
export function statusesBefore(status: MessagingStatus): MessagingStatus[] {
  return MESSAGING_STATUS_ORDER.slice(
    0,
    MESSAGING_STATUS_ORDER.indexOf(status),
  );
}

/** O mais avançado dos dois, na ordem de `MESSAGING_STATUS_ORDER`. */
export function furthestStatus(
  a: MessagingStatus,
  b: MessagingStatus,
): MessagingStatus {
  return MESSAGING_STATUS_ORDER.indexOf(a) >= MESSAGING_STATUS_ORDER.indexOf(b)
    ? a
    : b;
}

/** Tetos de entrada do envio, para impedir gravar e enfileirar conteúdo sem limite. */
export const MESSAGING_LIMITS = {
  text: 65_536,
  caption: 1_024,
  fileName: 255,
  phone: 32,
  id: 64,
  /** Valor de uma variável de template (a Meta limita o parâmetro a 1024). */
  templateValue: 1_024,
  templateValues: 50,
} as const;

export const MessagingDirectionConst = {
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND',
} as const;
export type MessagingDirection =
  (typeof MessagingDirectionConst)[keyof typeof MessagingDirectionConst];

/** Valores do filtro optOut da lista de contatos, no vocabulário do operador. */
export const MessagingContactSendingConst = {
  ALLOWED: 'ALLOWED',
  BLOCKED: 'BLOCKED',
} as const;

/** Flags do módulo. `MESSAGING` é o pai e nasce SEM roles — ver o seed e docs/backend/messaging.md. */
export const MessagingFeatureFlag = {
  ROOT: 'MESSAGING',
  CONTACTS: 'MESSAGING_CONTACTS',
  CHAT: 'MESSAGING_CHAT',
  TEMPLATES: 'MESSAGING_TEMPLATES',
} as const;

/** Espelha o enum Prisma `MessagingTemplateCategory` — domínio não importa `@prisma/client`. */
export const MessagingTemplateCategoryConst = {
  AUTHENTICATION: 'AUTHENTICATION',
  UTILITY: 'UTILITY',
  MARKETING: 'MARKETING',
} as const;
export type MessagingTemplateCategory =
  (typeof MessagingTemplateCategoryConst)[keyof typeof MessagingTemplateCategoryConst];

/** Espelha o enum Prisma `MessagingTemplateApproval`. */
export const MessagingTemplateApprovalConst = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAUSED: 'PAUSED',
  DISABLED: 'DISABLED',
} as const;
export type MessagingTemplateApproval =
  (typeof MessagingTemplateApprovalConst)[keyof typeof MessagingTemplateApprovalConst];

/** Chaves SystemConfiguration de mensageria válidas para o sistema inteiro: o webhook. */
export const MESSAGING_CONFIG_KEYS = {
  webhookKey: 'SYSTEM_MESSAGING_WEBHOOK_KEY',
  webhookPublicUrl: 'SYSTEM_MESSAGING_WEBHOOK_PUBLIC_URL',
  ignoreList: 'SYSTEM_MESSAGING_IGNORE_LIST',
} as const;

/** Só dígitos: o número chega do provider em formatos diferentes (com `+`, com sufixo de JID). */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

export const DEFAULT_GRAPH_VERSION = 'v21.0';

/** Caminho público do webhook, servido pelo proxy do front (o backend não é público). */
export const MESSAGING_WEBHOOK_PATH = '/api/messaging/webhook';

export const MESSAGING_CAPABILITY = 'MESSAGING';
