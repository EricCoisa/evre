'use server';
import type { ApiResponse } from '../../api/api';
import { getMessaging } from '@/lib/generated/messaging/messaging';
import type {
  MessagingProviderResponse,
  MessagingHealthStatus,
  MessagingMessagePage,
  ListMessagesParams,
  MessagingConnection,
  SaveMessagingConnectionPayload,
  SaveMessagingConnectionResult,
  MessagingSession,
  MessagingCapabilities,
  MessagingContactPage,
  ListContactsParams,
  SendMessagePayload,
  SendPresencePayload,
  UpdateMessagingContactPayload,
  CreateMessagingContactPayload,
  MessagingContact,
  MessagingConversationSummary,
  MessagingTemplateType,
  MessagingTemplateTypePage,
  MessagingTemplateCatalogItem,
  MessagingTemplatePage,
  ListTemplateTypesParams,
  ListTemplatesParams,
  CreateTemplateTypePayload,
  UpdateTemplateTypePayload,
  CreateTemplatePayload,
  UpdateTemplatePayload,
  SubmitTemplatePayload,
  MessagingTemplateSubmission,
  ReservedVariable,
  TemplateButtonsInfo,
  MetaTemplateDraft,
  MetaTemplateIssue,
  RemoteTemplateItem,
  LinkRemoteTemplatePayload,
  ImportRemoteTemplatePayload,
} from './types';
import type { SendMessageResponseDto } from '@/lib/generated/schemas';
import { wrap, wrapAs } from '../wrap';

const api = getMessaging();

export async function listMessagingConnections(params?: {
  archived?: boolean;
}): Promise<ApiResponse<MessagingConnection[]>> {
  return wrapAs(() => api.messagingControllerConnections(params));
}

/** Valida contra o provider e grava num passo só — ver saveStorageConfiguration. */
export async function createMessagingConnection(
  payload: SaveMessagingConnectionPayload,
): Promise<ApiResponse<SaveMessagingConnectionResult>> {
  return wrapAs(() => api.messagingControllerCreateConnectionHandler(payload));
}

export async function restoreMessagingConnection(
  id: string,
  payload?: SaveMessagingConnectionPayload,
): Promise<ApiResponse<SaveMessagingConnectionResult>> {
  return wrapAs(() =>
    api.messagingControllerRestoreConnectionHandler(
      id,
      payload ?? ({} as SaveMessagingConnectionPayload),
    ),
  );
}

export async function updateMessagingConnection(
  id: string,
  payload: SaveMessagingConnectionPayload,
): Promise<ApiResponse<SaveMessagingConnectionResult>> {
  return wrapAs(() =>
    api.messagingControllerUpdateConnectionHandler(id, payload),
  );
}

/** A conexão padrão envia quando ninguém escolhe a conexão (outros módulos, tools de IA). */
export async function setDefaultMessagingConnection(
  id: string,
): Promise<ApiResponse<MessagingConnection>> {
  return wrapAs(() => api.messagingControllerSetDefaultHandler(id));
}

/** Arquiva a conexão: para de enviar, sai das telas, mantém o histórico e libera o número. */
export async function archiveMessagingConnection(
  id: string,
): Promise<ApiResponse<MessagingConnection>> {
  return wrapAs(() => api.messagingControllerArchiveConnectionHandler(id));
}

export async function getMessagingHealth(
  connectionId: string,
): Promise<ApiResponse<MessagingHealthStatus>> {
  return wrapAs(() => api.messagingControllerHealth(connectionId));
}

export async function sendMessage(
  payload: SendMessagePayload,
): Promise<ApiResponse<SendMessageResponseDto>> {
  return wrap(() => api.messagingControllerSendMessage(payload));
}

/** Efêmero: falha aqui não deve virar toast, a tela segue funcionando sem o indicador. */
export async function sendPresence(
  payload: SendPresencePayload,
): Promise<ApiResponse<void>> {
  return wrap(() => api.messagingControllerPresence(payload));
}

export async function listMessages(
  params: ListMessagesParams = {},
): Promise<ApiResponse<MessagingMessagePage>> {
  return wrapAs(() => api.messagingControllerList(params));
}

export async function getMessagingCapabilities(
  connectionId: string,
): Promise<ApiResponse<MessagingCapabilities>> {
  return wrap(() => api.messagingControllerCapabilities(connectionId));
}

export async function listMessagingContacts(
  params: ListContactsParams = {},
): Promise<ApiResponse<MessagingContactPage>> {
  return wrapAs(() => api.messagingControllerListContactsHandler(params));
}

export async function createMessagingContact(
  payload: CreateMessagingContactPayload,
): Promise<ApiResponse<MessagingContact>> {
  return wrap(() => api.messagingControllerCreateContactHandler(payload));
}

export async function updateMessagingContact(
  contactId: string,
  payload: UpdateMessagingContactPayload,
): Promise<ApiResponse<MessagingContact>> {
  return wrap(() =>
    api.messagingControllerUpdateContactHandler(contactId, payload),
  );
}

export async function connectMessagingSession(
  connectionId: string,
): Promise<ApiResponse<MessagingSession>> {
  return wrapAs(() => api.messagingControllerConnectSession(connectionId));
}

export async function getMessagingSession(
  connectionId: string,
): Promise<ApiResponse<MessagingSession>> {
  return wrapAs(() => api.messagingControllerSessionStatus(connectionId));
}

export async function disconnectMessagingSession(
  connectionId: string,
): Promise<ApiResponse<MessagingProviderResponse>> {
  return wrapAs(() => api.messagingControllerDisconnectSession(connectionId));
}

/** As threads de um telefone, para o seletor decidir entre abrir direto, listar ou escolher a conexão. */
export async function listMessagingConversations(
  phone: string,
): Promise<ApiResponse<MessagingConversationSummary[]>> {
  return wrap(() => api.messagingControllerConversationsHandler({ phone }));
}

// --- Catálogo de templates ---

/** Variáveis reservadas do sistema — fonte única; o front nunca mantém cópia da lista. */
export async function listTemplateVariables(): Promise<ApiResponse<ReservedVariable[]>> {
  return wrap(() => api.messagingTemplateControllerListTemplateVariablesHandler());
}

/** As mesmas regras que barram a submissão, sobre um rascunho — nada é gravado. */
export async function checkMetaTemplate(
  draft: MetaTemplateDraft,
): Promise<ApiResponse<{ issues: MetaTemplateIssue[] }>> {
  return wrapAs(() => api.messagingTemplateControllerCheckMetaTemplateHandler(draft as never));
}

/** Botões reservados liberáveis + quais chaves já têm handler em código. */
export async function listTemplateButtons(): Promise<ApiResponse<TemplateButtonsInfo>> {
  return wrap(() => api.messagingTemplateControllerListTemplateButtonsHandler());
}

export async function listTemplateTypes(
  params: ListTemplateTypesParams = {},
): Promise<ApiResponse<MessagingTemplateTypePage>> {
  return wrapAs(() => api.messagingTemplateControllerListTemplateTypes(params));
}

export async function createTemplateType(
  payload: CreateTemplateTypePayload,
): Promise<ApiResponse<MessagingTemplateType>> {
  return wrapAs(() =>
    api.messagingTemplateControllerCreateTemplateType(payload as never),
  );
}

export async function updateTemplateType(
  id: string,
  payload: UpdateTemplateTypePayload,
): Promise<ApiResponse<MessagingTemplateType>> {
  return wrapAs(() =>
    api.messagingTemplateControllerUpdateTemplateType(id, payload as never),
  );
}

export async function removeTemplateType(id: string): Promise<ApiResponse<void>> {
  return wrap(() => api.messagingTemplateControllerRemoveTemplateType(id));
}

export async function listTemplates(
  params: ListTemplatesParams = {},
): Promise<ApiResponse<MessagingTemplatePage>> {
  return wrapAs(() => api.messagingTemplateControllerListTemplatesHandler(params));
}

export async function createTemplate(
  payload: CreateTemplatePayload,
): Promise<ApiResponse<MessagingTemplateCatalogItem>> {
  return wrapAs(() =>
    api.messagingTemplateControllerCreateTemplateHandler(payload as never),
  );
}

export async function updateTemplate(
  id: string,
  payload: UpdateTemplatePayload,
): Promise<ApiResponse<MessagingTemplateCatalogItem>> {
  return wrapAs(() =>
    api.messagingTemplateControllerUpdateTemplateHandler(id, payload as never),
  );
}

/** `remote` remove também na Meta (padrão da UI); `false` apaga só localmente. */
export async function removeTemplate(id: string, remote = true): Promise<ApiResponse<void>> {
  return wrap(() =>
    api.messagingTemplateControllerRemoveTemplateHandler(id, { remote: String(remote) }),
  );
}

/** Sempre manual: cria/edita na WABA da conexão e devolve a submissão (PENDING até o webhook decidir). */
export async function submitTemplate(
  id: string,
  payload: SubmitTemplatePayload,
): Promise<ApiResponse<MessagingTemplateSubmission>> {
  return wrapAs(() =>
    api.messagingTemplateControllerSubmitTemplateHandler(id, payload as never),
  );
}

/** Sob demanda (abrir a tela): só bate na WABA se houver submissão PENDING antiga. */
export async function reconcileTemplateSubmissions(
  connectionId: string,
): Promise<ApiResponse<{ updated: number }>> {
  return wrapAs(() => api.messagingTemplateControllerReconcileHandler(connectionId));
}

/** Consulta os templates salvos na WABA do provedor (Meta) e analisa compatibilidade local */
export async function listRemoteTemplates(
  connectionId: string,
): Promise<ApiResponse<RemoteTemplateItem[]>> {
  return wrapAs(() => api.messagingTemplateControllerListRemoteTemplatesHandler(connectionId));
}

/** Vincula um template da Meta a um template existente na plataforma */
export async function linkRemoteTemplate(
  connectionId: string,
  payload: LinkRemoteTemplatePayload,
): Promise<ApiResponse<void>> {
  return wrap(() =>
    api.messagingTemplateControllerLinkRemoteTemplateHandler(connectionId, payload as never),
  );
}

/** Baixa e cria um template da Meta localmente e já o vincula à conexão */
export async function importRemoteTemplate(
  connectionId: string,
  payload: ImportRemoteTemplatePayload,
): Promise<ApiResponse<void>> {
  return wrap(() =>
    api.messagingTemplateControllerImportRemoteTemplateHandler(connectionId, payload as never),
  );
}


