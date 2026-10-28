'use client';

import {
  useInfiniteQuery,
  useMutation,
  keepPreviousData,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { Collector } from '@/lib/api/collector';
import { sendAttachment } from '@/lib/messaging/send-attachment';
import { useMessagingRealtime } from '@/hooks/use-messaging-realtime';
import {
  getMessagingCapabilities,
  listMessagingConnections,
  listMessagingConversations,
  getMessagingHealth,
  listMessages,
  listMessagingContacts,
  sendMessage,
  sendPresence,
  createMessagingContact,
  updateMessagingContact,
  listTemplateVariables,
  listTemplateButtons,
  checkMetaTemplate,
  listTemplateTypes,
  createTemplateType,
  updateTemplateType,
  removeTemplateType,
  listTemplates,
  createTemplate,
  updateTemplate,
  removeTemplate,
  submitTemplate,
  reconcileTemplateSubmissions,
  listRemoteTemplates,
  linkRemoteTemplate,
  importRemoteTemplate,
} from './api';
import type {
  MessagingCapabilities,
  MessagingConnection,
  MessagingContactPage,
  MessagingHealthStatus,
  MessagingMessagePage,
  ListContactsParams,
  ListMessagesParams,
  SendMessagePayload,
  UpdateMessagingContactPayload,
  ListTemplateTypesParams,
  ListTemplatesParams,
  CreateMessagingContactPayload,
  CreateTemplateTypePayload,
  UpdateTemplateTypePayload,
  CreateTemplatePayload,
  UpdateTemplatePayload,
  SubmitTemplatePayload,
  MessagingTemplateTypePage,
  MessagingTemplatePage,
  ReservedVariable,
  TemplateButtonsInfo,
  MetaTemplateDraft,
  MetaTemplateIssue,
  RemoteTemplateItem,
  LinkRemoteTemplatePayload,
  ImportRemoteTemplatePayload,
} from './types';

/** Janela em que a saúde da conexão fica fresca sem refetch. */
const HEALTH_FALLBACK_POLL_MS = 30_000;

/** Conexões (um número em um provider cada). Sem credenciais: só se os segredos estão preenchidos.
 *  `enabled: false` evita a consulta e o SSE para quem não tem acesso ao módulo (ex.: provider global do chat). */
export function useMessagingConnections(enabled = true) {
  useMessagingRealtime(enabled);
  return useQuery<MessagingConnection[]>({
    queryKey: ['messaging', 'connections'],
    queryFn: Collector(() => listMessagingConnections({ archived: false })),
    refetchOnWindowFocus: true,
    enabled,
  });
}

/** Conexões arquivadas (que podem ser reativadas preservando histórico e número). */
export function useMessagingArchivedConnections() {
  useMessagingRealtime();
  return useQuery<MessagingConnection[]>({
    queryKey: ['messaging', 'connections', 'archived'],
    queryFn: Collector(() => listMessagingConnections({ archived: true })),
    refetchOnWindowFocus: true,
  });
}

/** Saúde de UMA conexão: credencial válida e, nos providers com QR, sessão conectada. */
export function useMessagingHealth(connectionId: string | undefined) {
  useMessagingRealtime();
  const { data, isLoading } = useQuery<MessagingHealthStatus>({
    queryKey: ['messaging', 'health', connectionId],
    queryFn: Collector(() => getMessagingHealth(connectionId as string)),
    enabled: !!connectionId,
    staleTime: HEALTH_FALLBACK_POLL_MS,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  return {
    operational: data?.operational ?? false,
    reason: data?.reason,
    isLoading,
  };
}

/** Histórico de uma página, filtrável por telefone e direção. Para a conversa use `useMessageThread`. */
export function useMessages(params: ListMessagesParams = {}) {
  useMessagingRealtime();
  return useQuery<MessagingMessagePage>({
    queryKey: ['messaging', 'messages', params],
    queryFn: Collector(() => listMessages(params)),
    refetchOnWindowFocus: true,
  });
}

const THREAD_PAGE_SIZE = 30;

/** Conversa de um telefone, paginada para trás; o refetch refaz todas as páginas já carregadas juntas. */
export function useMessageThread(connectionId: string, phone: string) {
  useMessagingRealtime();
  const fetchPage = Collector(listMessages);
  return useInfiniteQuery<MessagingMessagePage>({
    queryKey: ['messaging', 'messages', 'thread', connectionId, phone],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchPage({
        connectionId,
        phone,
        page: pageParam as number,
        limit: THREAD_PAGE_SIZE,
      }),
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    refetchOnWindowFocus: true,
  });
}

export function useMessagingCapabilities(connectionId: string | undefined) {
  return useQuery<MessagingCapabilities>({
    queryKey: ['messaging', 'capabilities', connectionId],
    queryFn: Collector(() => getMessagingCapabilities(connectionId as string)),
    enabled: !!connectionId,
    staleTime: 1000 * 60 * 4,
    refetchOnWindowFocus: false,
  });
}

/** Indica, via capability, se alguma conexão ativa suporta botões nativos de template. */
export function useNativeButtonsSupport(): {
  supported: boolean;
  /** Alguma conexão tem fluxo de aprovação de template (Meta): é onde as regras da Meta valem. */
  approval: boolean;
  /** Conexões com fluxo de aprovação: as únicas onde submeter/sincronizar/remover no provedor faz sentido. */
  approvalConnectionIds: string[];
  isLoading: boolean;
} {
  const { data: connections, isLoading: loadingConnections } = useMessagingConnections();
  // Collector é hook (lê o contexto): uma vez aqui, não dentro do map.
  const fetchCapabilities = Collector(getMessagingCapabilities);
  const results = useQueries({
    queries: (connections ?? []).map((connection) => ({
      queryKey: ['messaging', 'capabilities', connection.id],
      queryFn: () => fetchCapabilities(connection.id),
      staleTime: 1000 * 60 * 4,
      refetchOnWindowFocus: false,
    })),
  });
  return {
    supported: results.some((r) => (r.data?.template?.components?.buttons?.length ?? 0) > 0),
    approval: results.some((r) => !!r.data?.template?.approval),
    approvalConnectionIds: (connections ?? [])
      .filter((_, index) => !!results[index]?.data?.template?.approval)
      .map((connection) => connection.id),
    isLoading: loadingConnections || results.some((r) => r.isLoading),
  };
}

/** Chave da lista de contatos; a tela passa a mesma ao DataTable para o retry achar a query certa. */
export const messagingContactsKey = (params: ListContactsParams = {}) =>
  ['messaging', 'contacts', params] as const;

export function useMessagingContacts(params: ListContactsParams = {}) {
  useMessagingRealtime();
  return useQuery<MessagingContactPage>({
    queryKey: messagingContactsKey(params),
    queryFn: Collector(() => listMessagingContacts(params)),
    // Sem isto cada busca/filtro/página zera `data` e o DataTable troca a tela (e o campo de busca) por skeleton.
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
}

/** Resolve as threads de um telefone — usado pelo seletor de conversa ao abrir um chat. */
export function useResolveConversations() {
  return Collector(listMessagingConversations);
}

export function useCreateMessagingContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: Collector((payload: CreateMessagingContactPayload) =>
      createMessagingContact(payload),
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['messaging', 'contacts'] });
    },
  });
}

export function useUpdateMessagingContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: Collector((input: {
      contactId: string;
      payload: UpdateMessagingContactPayload;
    }) => updateMessagingContact(input.contactId, input.payload)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['messaging', 'contacts'] });
    },
  });
}

function useRefreshAfterSend() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['messaging', 'messages'] });
    void queryClient.invalidateQueries({ queryKey: ['messaging', 'contacts'] });
  };
}

/** Texto e template, pela server action tipada. Erro vira toast no `Collector`. */
export function useSendMessage() {
  return useMutation({
    mutationFn: Collector((payload: SendMessagePayload) => sendMessage(payload)),
    onSuccess: useRefreshAfterSend(),
  });
}

/** Efêmero: sem toast e sem invalidar nada — `sendPresence` já engole o erro no envelope da API. */
export function useSendPresence() {
  return useMutation({ mutationFn: sendPresence });
}

/** Anexo (multipart), pelo proxy do front. Não é server action, então o erro vira toast aqui. */
export function useSendAttachment() {
  return useMutation({
    mutationFn: sendAttachment,
    onSuccess: useRefreshAfterSend(),
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Threads de um telefone — reativo, para o gate de 24h (lastInboundAt) na própria conversa aberta. */
export function useMessagingConversations(phone: string | undefined) {
  return useQuery({
    queryKey: ['messaging', 'conversations', phone],
    queryFn: Collector(() => listMessagingConversations(phone as string)),
    enabled: !!phone,
    refetchOnWindowFocus: true,
  });
}

// --- Catálogo de templates ---

/** Fonte única: o front nunca mantém cópia da lista de reservadas. */
export function useTemplateVariables() {
  return useQuery<ReservedVariable[]>({
    queryKey: ['messaging', 'template-variables'],
    queryFn: Collector(listTemplateVariables),
    staleTime: Infinity,
  });
}

/** Consulta no servidor os problemas que a Meta apontaria no rascunho do template. */
export function useMetaTemplateCheck(draft: MetaTemplateDraft, enabled: boolean) {
  const { data, isFetching } = useQuery<{ issues: MetaTemplateIssue[] }>({
    queryKey: ['messaging', 'meta-check', draft],
    queryFn: Collector(() => checkMetaTemplate(draft)),
    enabled: enabled && !!draft.body.trim(),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });
  return { issues: data?.issues ?? [], isChecking: isFetching };
}

/** Reservados liberáveis e handlers registrados em código — o código manda, o front só consulta. */
export function useTemplateButtons() {
  return useQuery<TemplateButtonsInfo>({
    queryKey: ['messaging', 'template-buttons'],
    queryFn: Collector(listTemplateButtons),
    staleTime: 1000 * 60,
  });
}

export function useTemplateTypes(params: ListTemplateTypesParams = {}) {
  return useQuery<MessagingTemplateTypePage>({
    queryKey: ['messaging', 'template-types', params],
    queryFn: Collector(() => listTemplateTypes(params)),
    placeholderData: keepPreviousData,
    // O default global é `refetchOnMount: false`: sem isto, um tipo criado em outra aba da página
    // (query invalidada mas desmontada) só apareceria no próximo F5.
    refetchOnMount: true,
  });
}

function useInvalidateTemplateTypes() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['messaging', 'template-types'] });
}

export function useCreateTemplateType() {
  const invalidate = useInvalidateTemplateTypes();
  return useMutation({
    mutationFn: Collector((payload: CreateTemplateTypePayload) => createTemplateType(payload)),
    onSuccess: invalidate,
  });
}

export function useUpdateTemplateType() {
  const invalidate = useInvalidateTemplateTypes();
  return useMutation({
    mutationFn: Collector((input: { id: string; payload: UpdateTemplateTypePayload }) =>
      updateTemplateType(input.id, input.payload),
    ),
    onSuccess: invalidate,
  });
}

export function useRemoveTemplateType() {
  const invalidate = useInvalidateTemplateTypes();
  return useMutation({
    mutationFn: Collector((id: string) => removeTemplateType(id)),
    onSuccess: invalidate,
  });
}

export function useTemplates(params: ListTemplatesParams = {}) {
  // Aprovação chega por webhook: o evento `templates` do SSE refaz esta lista.
  useMessagingRealtime();
  return useQuery<MessagingTemplatePage>({
    queryKey: ['messaging', 'templates', params],
    queryFn: Collector(() => listTemplates(params)),
    // Status de aprovação muda por webhook; ao voltar à aba, mostra o estado atual (ver useTemplateTypes).
    refetchOnMount: true,
    placeholderData: keepPreviousData,
  });
}

/** Catálogo de UMA conexão (filtrado por approvalStatus), para o dialog do chat ler sem paginação. */
export function useTemplatesForConnection(connectionId: string | undefined) {
  return useQuery<MessagingTemplatePage>({
    queryKey: ['messaging', 'templates', 'for-connection', connectionId],
    queryFn: Collector(() => listTemplates({ connectionId, pagination: false })),
    enabled: !!connectionId,
  });
}

function useInvalidateTemplates() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['messaging', 'templates'] });
}

export function useCreateTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: Collector((payload: CreateTemplatePayload) => createTemplate(payload)),
    onSuccess: invalidate,
  });
}

export function useUpdateTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: Collector((input: { id: string; payload: UpdateTemplatePayload }) =>
      updateTemplate(input.id, input.payload),
    ),
    onSuccess: invalidate,
  });
}

export function useRemoveTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: Collector((input: { id: string; remote: boolean }) =>
      removeTemplate(input.id, input.remote),
    ),
    onSuccess: invalidate,
  });
}

export function useSubmitTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: Collector((input: { id: string; payload: SubmitTemplatePayload }) =>
      submitTemplate(input.id, input.payload),
    ),
    onSuccess: invalidate,
  });
}

export function useReconcileTemplateSubmissions() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: Collector((connectionId: string) => reconcileTemplateSubmissions(connectionId)),
    onSuccess: invalidate,
  });
}

export function useRemoteTemplates(connectionId: string | undefined, enabled = true) {
  return useQuery<RemoteTemplateItem[]>({
    queryKey: ['messaging', 'remote-templates', connectionId],
    queryFn: Collector(() => listRemoteTemplates(connectionId as string)),
    enabled: enabled && !!connectionId,
    refetchOnWindowFocus: false,
  });
}

export function useLinkRemoteTemplate() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTemplates();
  return useMutation<
    void,
    Error,
    { connectionId: string; payload: LinkRemoteTemplatePayload }
  >({
    mutationFn: Collector(
      (input: { connectionId: string; payload: LinkRemoteTemplatePayload }) =>
        linkRemoteTemplate(input.connectionId, input.payload),
    ),
    onSuccess: (_, variables) => {
      invalidate();
      void queryClient.invalidateQueries({
        queryKey: ['messaging', 'remote-templates', variables.connectionId],
      });
    },
  });
}

export function useImportRemoteTemplate() {
  const queryClient = useQueryClient();
  const invalidateTemplates = useInvalidateTemplates();
  const invalidateTypes = useInvalidateTemplateTypes();
  return useMutation<
    void,
    Error,
    { connectionId: string; payload: ImportRemoteTemplatePayload }
  >({
    mutationFn: Collector(
      (input: { connectionId: string; payload: ImportRemoteTemplatePayload }) =>
        importRemoteTemplate(input.connectionId, input.payload),
    ),
    onSuccess: (_, variables) => {
      invalidateTemplates();
      invalidateTypes();
      void queryClient.invalidateQueries({
        queryKey: ['messaging', 'remote-templates', variables.connectionId],
      });
    },
  });
}


