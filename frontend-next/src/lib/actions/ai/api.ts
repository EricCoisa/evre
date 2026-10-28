"use server";
import type { ApiResponse } from '../../api/api';
import { wrap, wrapAs } from '../wrap';
import { getAi } from '@/lib/generated/ai/ai';
import type { CreateConversationDto, SaveAiConfigDto, ListAiModelsDto } from '@/lib/generated/schemas';

export interface AiHealthStatus {
  operational: boolean;
  reason?: string;
  byokRequired?: boolean;
  userKeyConfigured?: boolean;
}

export interface AiProviderResponse {
  status: boolean;
  data: string;
}

/** Corpo de `PUT /ai/config` e `/ai/user-config`. `apiKey` vazia = manter a gravada. */
export interface SaveAiConfigPayload {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface AiModelsResult { models: string[]; default: string }

/** Corpo de `POST /ai/models/candidate`. Vazio usa a credencial/baseUrl já gravados. */
export interface ListAiModelsPayload {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface AiToolInfo { name: string; description: string }

/** `description` é o texto que o modelo lê; a UI usa `descriptionKey` (i18n) e só cai nele como fallback. */
export interface AiToolPermission { name: string; description: string; descriptionKey: string; group: string; enabled: boolean }

// Local shapes — Orval generates `void` for these until openapi:export is re-run
export interface AiConversationSummary {
  id: string;
  title?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AiConversationListResult {
  data: AiConversationSummary[];
  meta?: { total: number; page: number; limit: number; totalPages: number };
}

/** Uma mensagem do histórico da conversa, vinda do checkpoint LangGraph. */
export interface AiMessageRecord {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: { id: string; name: string; input: unknown }[];
  toolCallId?: string | null;
}

export interface AiConversationDetail extends AiConversationSummary {
  messages?: AiMessageRecord[];
}

// Not exported — server-action files may only export async functions
const aiApi = getAi();

export async function getAiHealth(): Promise<ApiResponse<AiHealthStatus>> {
  return wrapAs(() => aiApi.aiControllerCheckHealth());
}

/** Valida contra o provider e salva num passo só (configuração da plataforma). */
export async function saveAiConfiguration(
  payload: SaveAiConfigPayload,
): Promise<ApiResponse<AiProviderResponse>> {
  return wrapAs(() => aiApi.aiControllerSaveConfiguration(payload as SaveAiConfigDto));
}

export async function listConversations(): Promise<ApiResponse<AiConversationListResult>> {
  return wrap(
    () =>
      aiApi.aiControllerListConversations() as unknown as Promise<AiConversationListResult>,
  );
}

export async function createConversation(dto: { title?: string }): Promise<ApiResponse<string>> {
  return wrap(
    () =>
      aiApi.aiControllerCreateConversation(dto as CreateConversationDto) as unknown as Promise<string>,
  );
}

export async function getConversation(id: string): Promise<ApiResponse<AiConversationDetail>> {
  return wrap(
    () => aiApi.aiControllerGetConversation(id) as unknown as Promise<AiConversationDetail>,
  );
}

/** Descarta `messageId` e tudo depois dele; devolve o histórico já truncado. */
export async function rewindConversation(
  id: string,
  messageId: string,
): Promise<ApiResponse<AiMessageRecord[]>> {
  return wrapAs(() => aiApi.aiControllerRewindConversation(id, { messageId }));
}

export async function deleteConversation(id: string): Promise<ApiResponse<void>> {
  return wrap(() => aiApi.aiControllerDeleteConversation(id) as unknown as Promise<void>);
}

export async function getAiModels(): Promise<ApiResponse<AiModelsResult>> {
  return wrapAs(() => aiApi.aiControllerListModels());
}

/** Lista modelos reais de um provider ainda não salvo (dialog do settings). */
export async function listCandidateAiModels(
  payload: ListAiModelsPayload,
): Promise<ApiResponse<{ models: string[] }>> {
  return wrapAs(() => aiApi.aiControllerListCandidateModels(payload as ListAiModelsDto));
}

export async function getAiTools(): Promise<ApiResponse<AiToolInfo[]>> {
  return wrapAs(() => aiApi.aiControllerListTools());
}

export async function getAiToolPermissions(): Promise<ApiResponse<AiToolPermission[]>> {
  return wrapAs(() => aiApi.aiControllerListToolPermissions());
}

export async function revokeAiToolAccess(name: string): Promise<ApiResponse<void>> {
  return wrapAs(() => aiApi.aiControllerRevokeToolAccess(name));
}

export async function allowAiToolAccess(name: string): Promise<ApiResponse<AiToolPermission>> {
  return wrapAs(() => aiApi.aiControllerAllowToolAccess(name));
}

/** Mesmo fluxo, gravando na configuração do próprio usuário (BYOK). */
export async function saveUserAiConfiguration(
  payload: SaveAiConfigPayload,
): Promise<ApiResponse<AiProviderResponse>> {
  return wrapAs(() => aiApi.aiControllerSaveUserConfiguration(payload as SaveAiConfigDto));
}
