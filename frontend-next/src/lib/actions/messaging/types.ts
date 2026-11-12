import type {
  CreateMessagingContactDto,
  MessagingCapabilitiesDto,
  MessagingContactDto,
  MessagingConversationSummaryDto,
  MessagingMessageDto,
  MessagingConnectionDto,
  MessagingTemplateTypeDto,
  MessagingTemplateDto,
  MessagingTemplateSubmissionDto,
  MessagingTemplateVariableDto,
  MessagingTemplateButtonsInfoDto,
  MetaTemplateIssueDto,
  MessagingReservedButtonDto,
  SaveMessagingConnectionDto,
  SaveMessagingConnectionResponseDto,
  SendMessageDto,
  SendPresenceDto,
  SendPresenceDtoState,
} from '@/lib/generated/schemas';
import type { PaginatedResponse } from '@/lib/types/pagination.types';

export interface MessagingProviderResponse {
  status: boolean;
  data: string;
}

export interface MessagingHealthStatus {
  operational: boolean;
  reason?: string;
}

/** Dados do template já resolvido e renderizado, presentes apenas em messages.type === 'TEMPLATE'. */
export interface MessageTemplateData {
  name: string;
  language: string;
  category: MessagingTemplateCategory;
  body: string;
  header?: TemplateHeader;
  footer?: string;
  buttons?: TemplateButton[];
  values?: Record<string, string>;
}

/** Type-safe message union: templateData está presente APENAS quando type === 'TEMPLATE'. */
export type MessagingMessage =
  | (Omit<MessagingMessageDto, 'templateData'> & {
      type: Exclude<MessagingMessageDto['type'], 'TEMPLATE'>;
      templateData?: undefined;
    })
  | (MessagingMessageDto & {
      type: 'TEMPLATE';
      templateData: MessageTemplateData;
    });

export type MessagingMessagePage = PaginatedResponse<MessagingMessage>;

export type MessagingContact = MessagingContactDto;
export type MessagingContactPage = PaginatedResponse<MessagingContact>;

export type MessagingConversationSummary = MessagingConversationSummaryDto;

export type MessagingCapabilities = MessagingCapabilitiesDto;

export type MessagingConnection = MessagingConnectionDto;
export type SaveMessagingConnectionPayload = SaveMessagingConnectionDto;
export type SaveMessagingConnectionResult = SaveMessagingConnectionResponseDto;
export type MessagingProviderKind = MessagingConnectionDto['provider'];

export interface ListMessagesParams {
  page?: number;
  limit?: number;
  connectionId?: string;
  phone?: string;
  direction?: 'INBOUND' | 'OUTBOUND';
}

export interface ListContactsParams {
  page?: number;
  limit?: number;
  connectionId?: string;
  search?: string;
}

export type SendMessagePayload = SendMessageDto;

export type MessagingPresenceState = SendPresenceDtoState;
export type SendPresencePayload = SendPresenceDto;

export interface UpdateMessagingContactPayload {
  name?: string | null;
  optOut?: boolean;
}

export type CreateMessagingContactPayload = CreateMessagingContactDto;

export interface MessagingSession {
  /** `false` quando o provider ativo não pareia por QR (Meta). */
  supported?: boolean;
  /** `NOT_CREATED`: a instância não existe no provider — diferente de criada e desconectada. */
  status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'NOT_CREATED';
  qrCode?: string;
  pairingCode?: string;
  phoneNumber?: string;
  /** Pareou com número diferente do da conexão, que já é de outra, ou de conexão arquivada: a sessão foi desfeita. */
  error?: 'PHONE_MISMATCH' | 'PHONE_IN_USE' | 'PHONE_ARCHIVED';
  /** Número que a conexão exige ao reconectar. */
  expectedPhone?: string;
}

// --- Catálogo de templates ---
// `buttons`/`variables` saem tipados fraco no cliente gerado (union/refine não vira TS limpo pelo
// Orval); os tipos abaixo espelham o domínio real do backend — ver messaging-provider.interface.ts.

export type TemplateVariableType = 'STRING' | 'NUMBER' | 'DATE';
export interface TemplateVariable {
  name: string;
  type: TemplateVariableType;
  required: boolean;
  default?: string;
  format?: string;
  /** true = reservada do sistema liberada neste tipo (só o nome importa; o resto vem do código). */
  reserved?: boolean;
  /** true = o valor fica mascarado no histórico de mensagens (ex.: código de verificação). */
  sensitive?: boolean;
}

export type TemplateHeader =
  | { kind: 'TEXT'; text: string }
  | { kind: 'IMAGE'; url: string };
/** `slot` liga o botão a um espaço tipado do tipo de template; ausente = botão livre, sem evento. */
export type TemplateButton =
  | { kind: 'URL'; label: string; url: string; slot?: string }
  | { kind: 'QUICK_REPLY'; label: string; payload?: string; slot?: string }
  | { kind: 'PHONE_NUMBER'; label: string; phoneNumber: string; slot?: string }
  | { kind: 'COPY_CODE'; label: string; payload?: string; slot?: string };

/** Botão tipado de um tipo de template (espelha StoredTypeButton do backend). */
export interface TemplateButtonSlot {
  key: string;
  kind: 'QUICK_REPLY' | 'URL';
  /** Reservado do sistema liberado no tipo (ex.: opt_out). */
  reserved?: boolean;
  required?: boolean;
  /** `URL`: parte fixa do link; o sufixo é informado por quem envia. */
  urlBase?: string;
  /** `URL`: sufixo é um token, mascarado no histórico. */
  sensitive?: boolean;
}

export type MessagingTemplateCategory = 'AUTHENTICATION' | 'UTILITY' | 'MARKETING';

export type MessagingTemplateType = Omit<MessagingTemplateTypeDto, 'variables' | 'buttons'> & {
  variables: TemplateVariable[];
  buttons: TemplateButtonSlot[];
  isSystem?: boolean;
};
export type MessagingTemplateTypePage = PaginatedResponse<MessagingTemplateType>;

export type MessagingTemplateCatalogItem = Omit<
  MessagingTemplateDto,
  'category' | 'header' | 'footer' | 'buttons' | 'approvalStatus' | 'previousCategory'
> & {
  category: MessagingTemplateCategory;
  header?: TemplateHeader | null;
  footer?: string | null;
  buttons?: TemplateButton[] | null;
  approvalStatus?: string | null;
  /** Categoria antes de a Meta reclassificar; presente até o operador dar ciente. */
  previousCategory?: MessagingTemplateCategory | null;
};
export type MessagingTemplatePage = PaginatedResponse<MessagingTemplateCatalogItem>;

export interface ListTemplateTypesParams {
  page?: number;
  limit?: number;
}

export interface ListTemplatesParams {
  page?: number;
  limit?: number;
  typeId?: string;
  /** Presente = cada template sai com `approvalStatus` calculado para essa conexão. */
  connectionId?: string;
  pagination?: boolean;
}

export interface CreateTemplateTypePayload {
  key: string;
  name: string;
  variables?: TemplateVariable[];
  buttons?: TemplateButtonSlot[];
}
export interface UpdateTemplateTypePayload {
  name?: string;
  variables?: TemplateVariable[];
  buttons?: TemplateButtonSlot[];
}

export interface CreateTemplatePayload {
  typeId: string;
  key: string;
  language: string;
  category: MessagingTemplateCategory;
  header?: TemplateHeader;
  body: string;
  footer?: string;
  buttons?: TemplateButton[];
  bypassOptOut?: boolean;
}
export interface UpdateTemplatePayload {
  category?: MessagingTemplateCategory;
  header?: TemplateHeader | null;
  body?: string;
  footer?: string | null;
  buttons?: TemplateButton[] | null;
  bypassOptOut?: boolean;
  acknowledgeCategoryChange?: boolean;
}

export interface SubmitTemplatePayload {
  connectionId: string;
  examples?: Record<string, string>;
  headerImageUrl?: string;
}
export type MessagingTemplateSubmission = MessagingTemplateSubmissionDto;

/** Variável reservada do sistema: global a qualquer template, nunca digitada pelo operador. */
export type ReservedVariable = MessagingTemplateVariableDto;

/** Problema que a Meta costuma apontar no template (`error` barra a submissão; `warning` só avisa). */
export type MetaTemplateIssue = MetaTemplateIssueDto;

/** Rascunho enviado à checagem: o que as regras da Meta olham. */
export interface MetaTemplateDraft {
  category: MessagingTemplateCategory;
  body: string;
  header?: TemplateHeader | null;
  footer?: string | null;
  buttons?: TemplateButton[] | null;
}

/** Reservados e handlers registrados em código (GET /messaging/template-buttons). */
export type TemplateButtonsInfo = MessagingTemplateButtonsInfoDto;
export type ReservedButton = MessagingReservedButtonDto;

export interface RemoteTemplateItem {
  providerTemplateId: string;
  name: string;
  language: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';
  reason?: string;
  category?: 'AUTHENTICATION' | 'UTILITY' | 'MARKETING';
  linkedTemplateId?: string;
  linkedTemplateKey?: string;
  suggestedTemplates: Array<{
    id: string;
    key: string;
    language: string;
    category: string;
    exactMatch: boolean;
  }>;
}

export interface LinkRemoteTemplatePayload {
  remoteTemplateId: string;
  templateId: string;
}

export interface ImportRemoteTemplatePayload {
  remoteTemplateId: string;
  typeId?: string;
}


