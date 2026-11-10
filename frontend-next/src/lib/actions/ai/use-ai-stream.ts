import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@/hooks/use-translation';
import { getConversation, rewindConversation } from './api';
import { snapshotScreen } from '@/components/agent/screen-registry';

// Tag `invalidates` do backend → 1º segmento de queryKey no frontend; tag sem entrada casa por nome exato.
const INVALIDATION_TAG_QUERY_KEYS: Record<string, string[]> = {
  user: ['users', 'user', 'me'],
  route: ['routes', 'route'],
  'feature-flags': ['feature-flags', 'feature-flags-me'],
  auth: ['invites'],
  'role-route-access': ['roleRouteAccess', 'userRoles'],
  'system-configuration': ['system-configuration'],
  'user-configuration-definitions': ['user-configurations-definitions'],
  'user-configuration': ['user-configurations', 'user-configuration'],
  'user-route-access': ['userRouteAccess'],
  'api-keys': ['api-keys'],
  ai: ['ai'],
  storage: ['storage'],
  email: ['email'],
  // captcha não tem query própria hoje; as tools de captcha também emitem
  // 'system-configuration', que é o que a tela de settings observa.
  captcha: ['captcha'],
  // query key real é plural ('notifications'); sem esta entrada o fallback por nome
  // exato ('notification') não bate com nada e a invalidação vira no-op.
  notification: ['notifications'],
  company: ['companies', 'company'],
  proposal: ['proposals', 'proposal'],
  artifact: ['artifacts'],
};

interface AiStreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'approval_required' | 'error' | 'done' | 'reasoning';
  text?: string;
  toolCallId?: string;
  name?: string;
  input?: unknown;
  result?: unknown;
  invalidates?: string[];
  scope?: string;
  message?: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: unknown;
  toolCallId?: string;
};

export type ToolEvent = { id: string; name: string; input: unknown; result?: unknown };

// Estado transitório de um stream, por conversationId — nunca global.
interface ConversationStreamState {
  isStreaming: boolean;
  pendingText: string;
  reasoning: string;
  toolEvents: ToolEvent[];
  pendingApproval: { toolCallId: string; scope: string } | null;
  error: string | null;
}

const EMPTY_STREAM_STATE: ConversationStreamState = {
  isStreaming: false,
  pendingText: '',
  reasoning: '',
  toolEvents: [],
  pendingApproval: null,
  error: null,
};

interface UseAiStreamReturn {
  reasoning: string;
  toolEvents: ToolEvent[];
  messages: ChatMessage[];
  isStreaming: boolean;
  pendingText: string;
  pendingApproval: { toolCallId: string; scope: string } | null;
  error: string | null;
  sendMessage: (content: string, conversationIdOverride?: string) => Promise<void>;
  resolveApproval: (toolCallId: string, decision: 'once' | 'conversation' | 'deny') => Promise<void>;
  /** Descarta a mensagem e tudo depois dela, retornando o conteúdo descartado. */
  rewindTo: (messageId: string) => Promise<string | undefined>;
  stopStream: () => void;
}

function httpErrorKey(status: number): string {
  if (status === 401) return 'errorUnauthorized';
  if (status === 403) return 'errorForbidden';
  if (status === 429) return 'errorRateLimited';
  if (status >= 500) return 'errorServer';
  return 'errorGeneric';
}

export function useAiStream(conversationId: string, model?: string): UseAiStreamReturn {
  const { t } = useTranslation('agent');
  const queryClient = useQueryClient();
  const router = useRouter();
  const [messagesByConv, setMessagesByConv] = useState<Record<string, ChatMessage[]>>({});
  const [streamsByConv, setStreamsByConv] = useState<Record<string, ConversationStreamState>>({});
  // Um AbortController por conversa — permite abortar só a de "conversationId" atual
  // (stopStream) sem afetar outras rodando em background.
  const controllersRef = useRef<Record<string, AbortController>>({});

  const patchStream = useCallback(
    (cid: string, patch: Partial<ConversationStreamState> | ((s: ConversationStreamState) => Partial<ConversationStreamState>)) => {
      setStreamsByConv(prev => {
        const cur = prev[cid] ?? EMPTY_STREAM_STATE;
        const delta = typeof patch === 'function' ? patch(cur) : patch;
        return { ...prev, [cid]: { ...cur, ...delta } };
      });
    },
    [],
  );

  const fetchMessages = useCallback(async (cid: string) => {
    if (!cid) return;
    // Server action — cookie/auth handled server-side; browser never hits the backend directly
    const res = await getConversation(cid);
    if (!res.success || !res.data) {
      if (!res.success) console.error('Failed to fetch messages:', res.message);
      return;
    }
    const conv = res.data;
    if (conv.messages) {
      setMessagesByConv(prev => ({
        ...prev,
        [cid]: conv.messages!.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          toolCalls: m.toolCalls,
          toolCallId: m.toolCallId ?? undefined,
        })),
      }));
    }
  }, []);

  useEffect(() => {
    // Busca as mensagens da conversa ao montar ou trocar de conversationId.
    if (conversationId && !controllersRef.current[conversationId]) fetchMessages(conversationId);
  }, [conversationId, fetchMessages]);

  // Ao desmontar (ex: saiu da página do agente), não deixa fetches SSE presos rodando.
  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      Object.values(controllers).forEach(c => c.abort());
    };
  }, []);

function processSseFrames(buffer: string, onEvent: (event: AiStreamEvent) => void): string {
  const frames = buffer.split('\n\n');
  const remainder = frames.pop() ?? '';
  for (const frame of frames) {
    const line = frame.split('\n').find(l => l.startsWith('data: '));
    if (!line) continue;
    try {
      const event: AiStreamEvent = JSON.parse(line.slice(6));
      onEvent(event);
    } catch (e) {
      console.warn('Failed to parse SSE event:', e);
    }
  }
  return remainder;
}

function invalidateTags(
  tags: string[] | undefined,
  queryClient: { invalidateQueries: (opts: { predicate: (q: { queryKey: readonly unknown[] }) => boolean; refetchType: 'all' }) => void },
  router: { refresh: () => void },
) {
  if (!tags?.length) return;
  tags.forEach(tag => {
    const prefixes = INVALIDATION_TAG_QUERY_KEYS[tag] ?? [tag];
    queryClient.invalidateQueries({
      predicate: q => prefixes.includes(String(q.queryKey[0])),
      refetchType: 'all',
    });
  });
  router.refresh();
}

  // `page` sai daqui porque os dois turnos (mensagem e aprovação) passam por este fetch.
  const consumeStream = useCallback(async (cid: string, url: string, body: Record<string, unknown>) => {
    const controller = new AbortController();
    controllersRef.current[cid] = controller;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          page: location.pathname + location.search,
          screen: snapshotScreen(),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        patchStream(cid, { error: bodyText || t(httpErrorKey(res.status)) });
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = processSseFrames(buffer, event => handleEventRef.current(cid, event));
      }
    } catch (error) {
      if ((error instanceof DOMException || error instanceof Error) && error.name === 'AbortError') {
        // Stream was stopped intentionally
        return;
      }
      patchStream(cid, s => ({ error: s.error ?? t('errorNetwork') }));
      console.error('Stream error:', error);
    } finally {
      patchStream(cid, { isStreaming: false });
      delete controllersRef.current[cid];
    }
  }, [t, patchStream]);

  const handleEvent = useCallback((cid: string, event: AiStreamEvent) => {
    switch (event.type) {
      case 'text':
        patchStream(cid, s => ({ pendingText: s.pendingText + (event.text || '') }));
        break;
      case 'reasoning':
        patchStream(cid, s => ({ reasoning: s.reasoning + (event.text || '') }));
        break;
      case 'tool_call':
        patchStream(cid, s => ({
          toolEvents: [...s.toolEvents, { id: event.toolCallId!, name: event.name!, input: event.input! }],
        }));
        break;
      case 'tool_result':
        patchStream(cid, s => ({
          toolEvents: s.toolEvents.map(tool =>
            tool.id === event.toolCallId ? { ...tool, result: event.result } : tool,
          ),
        }));
        invalidateTags(event.invalidates, queryClient, router);
        break;
      case 'approval_required':
        patchStream(cid, { pendingApproval: { toolCallId: event.toolCallId!, scope: event.scope! } });
        break;
      case 'error':
        patchStream(cid, { error: event.message || t('errorGeneric'), isStreaming: false });
        // Sincroniza com o checkpoint mesmo no erro: a mensagem otimista tem id local.
        fetchMessages(cid);
        break;
      case 'done':
        patchStream(cid, { isStreaming: false, pendingText: '' });
        // Refetch conversation to hydrate from database
        fetchMessages(cid);
        // Invalidate conversation list to refresh titles
        queryClient.invalidateQueries({ queryKey: ['ai', 'conversations'] });
        break;
    }
  }, [queryClient, router, fetchMessages, patchStream, t]);

  // Use ref to avoid stale closure in consumeStream
  const handleEventRef = useRef(handleEvent);
  useEffect(() => {
    handleEventRef.current = handleEvent;
  }, [handleEvent]);

  const sendMessage = useCallback(async (content: string, conversationIdOverride?: string) => {
    const cid = conversationIdOverride || conversationId;
    if (!cid) return;

    patchStream(cid, {
      isStreaming: true,
      pendingText: '',
      reasoning: '',
      toolEvents: [],
      pendingApproval: null,
      error: null,
    });

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
    };
    setMessagesByConv(prev => ({ ...prev, [cid]: [...(prev[cid] ?? []), userMessage] }));

    await consumeStream(cid, `/api/agent/${cid}/stream`, { content, model });
  }, [conversationId, model, consumeStream, patchStream]);

  const resolveApproval = useCallback(async (toolCallId: string, decision: 'once' | 'conversation' | 'deny') => {
    const cid = conversationId;
    if (!cid) return;

    // Clear the approval card and resume the streaming indicator — the backend
    // continues the tool loop on the same SSE response.
    patchStream(cid, { pendingApproval: null, isStreaming: true, pendingText: '', error: null });

    await consumeStream(cid, `/api/agent/${cid}/approvals`, { toolCallId, decision });
  }, [conversationId, consumeStream, patchStream]);

  // Rebobina a conversa para um ponto anterior, truncando o histórico no backend.
  const rewindTo = useCallback(async (messageId: string): Promise<string | undefined> => {
    const cid = conversationId;
    if (!cid) return undefined;

    const target = (messagesByConv[cid] ?? []).find(m => m.id === messageId);
    const res = await rewindConversation(cid, messageId);
    if (!res.success) {
      patchStream(cid, { error: res.message || t('errorGeneric') });
      return undefined;
    }

    setMessagesByConv(prev => ({
      ...prev,
      [cid]: (res.data ?? []).map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
        toolCallId: m.toolCallId ?? undefined,
      })),
    }));

    return target?.role === 'user' ? target.content : undefined;
  }, [conversationId, messagesByConv, patchStream, t]);

  const stopStream = useCallback(() => {
    controllersRef.current[conversationId]?.abort();
    patchStream(conversationId, { isStreaming: false });
  }, [conversationId, patchStream]);

  const current = streamsByConv[conversationId] ?? EMPTY_STREAM_STATE;

  return {
    messages: messagesByConv[conversationId] ?? [],
    isStreaming: current.isStreaming,
    pendingText: current.pendingText,
    reasoning: current.reasoning,
    toolEvents: current.toolEvents,
    pendingApproval: current.pendingApproval,
    error: current.error,
    sendMessage,
    resolveApproval,
    rewindTo,
    stopStream,
  };
}
