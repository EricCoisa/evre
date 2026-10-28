import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAiStream } from './use-ai-stream';
import { getConversation, rewindConversation } from './api';

vi.mock('./api', () => ({
  getConversation: vi.fn(),
  rewindConversation: vi.fn(),
}));

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// O setup global devolve um refresh novo a cada chamada; aqui ele precisa ser estável
// para dar para afirmar em cima dele.
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: async () => {}, back: vi.fn(), refresh }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

const CONV = 'conv-1';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Resposta SSE de mentira com os frames `data: {...}` que o hook sabe ler. */
function sseResponse(events: unknown[]): Response {
  const body = events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('');
  const bytes = new TextEncoder().encode(body);
  return {
    ok: true,
    body: {
      getReader: () => {
        let sent = false;
        return {
          read: () =>
            Promise.resolve(
              sent ? { done: true, value: undefined } : ((sent = true), { done: false, value: bytes }),
            ),
        };
      },
    },
  } as unknown as Response;
}

describe('useAiStream — rewindTo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());

    vi.mocked(getConversation).mockResolvedValue({
      success: true,
      data: {
        id: CONV,
        messages: [
          { id: 'm1', role: 'user', content: 'pergunta original' },
          { id: 'm2', role: 'assistant', content: 'resposta' },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof getConversation>>);

    vi.mocked(rewindConversation).mockResolvedValue({
      success: true,
      data: [],
    } as unknown as Awaited<ReturnType<typeof rewindConversation>>);
  });

  async function renderReady() {
    const view = renderHook(() => useAiStream(CONV), { wrapper });
    await waitFor(() => expect(view.result.current.messages).toHaveLength(2));
    return view;
  }

  it('returns the rewound question instead of sending it again', async () => {
    const { result } = await renderReady();

    let returned: string | undefined;
    await act(async () => {
      returned = await result.current.rewindTo('m1');
    });

    expect(rewindConversation).toHaveBeenCalledWith(CONV, 'm1');
    expect(returned).toBe('pergunta original');
    // Nenhum stream disparado: mandar de volta é decisão de quem chamou.
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not return text when the rewind fails, so nothing is resent', async () => {
    vi.mocked(rewindConversation).mockResolvedValue({
      success: false,
      message: 'boom',
    } as unknown as Awaited<ReturnType<typeof rewindConversation>>);
    const { result } = await renderReady();

    let returned: string | undefined = 'nao deveria sobreviver';
    await act(async () => {
      returned = await result.current.rewindTo('m1');
    });

    expect(returned).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  // Rebobinar para uma resposta do assistente não tem texto de usuário para
  // devolver — a tela não deve preencher a caixa com a fala do agente.
  it('returns nothing when the target is not a user message', async () => {
    const { result } = await renderReady();

    let returned: string | undefined = 'nao deveria sobreviver';
    await act(async () => {
      returned = await result.current.rewindTo('m2');
    });

    expect(returned).toBeUndefined();
  });
});

describe('useAiStream — invalidação de tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConversation).mockResolvedValue({
      success: true,
      data: { id: CONV, messages: [] },
    } as unknown as Awaited<ReturnType<typeof getConversation>>);
  });

  it('refetcha query inativa da tag invalidada', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnMount: false } },
    });
    const queryFn = vi.fn().mockResolvedValue({ '/dashboard': { v: 1, blocks: [] } });

    // Query fora de tela: buscada uma vez e sem observador, como o dashboard durante o chat.
    await client.fetchQuery({ queryKey: ['user-configuration', 'PAGE_LAYOUTS'], queryFn });
    expect(queryFn).toHaveBeenCalledTimes(1);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          {
            type: 'tool_result',
            toolCallId: 't1',
            result: { pageKey: '/dashboard', blocks: 1 },
            invalidates: ['user-configuration'],
          },
        ]),
      ),
    );

    const { result } = renderHook(() => useAiStream(CONV), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      await result.current.sendMessage('muda o dashboard');
    });

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  });

  /** Uma tool que invalida algo também pede um render novo do Server Component. */
  it('pede um render novo do servidor quando a tool invalida algo', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          {
            type: 'tool_result',
            toolCallId: 't1',
            result: { key: 'AI_AGENT', enabled: false },
            invalidates: ['feature-flags'],
          },
        ]),
      ),
    );

    const { result } = renderHook(() => useAiStream(CONV), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      await result.current.sendMessage('desliga a flag AI_AGENT');
    });

    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  // Tool de leitura pura manda `invalidates: []` — nada mudou, nada a re-renderizar.
  it('não pede render novo quando a tool só leu', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          { type: 'tool_result', toolCallId: 't1', result: { count: 3 }, invalidates: [] },
        ]),
      ),
    );

    const { result } = renderHook(() => useAiStream(CONV), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      await result.current.sendMessage('quantos usuarios existem');
    });

    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('useAiStream — primeira mensagem de uma conversa nova', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AgentChatProvider é montado uma vez só (app/(private)/layout.tsx); `conversationId`
  // é uma prop que muda, não um remount. handleSendMessage chama setConversationId(id)
  // e sendMessage(text, id) no mesmo tick — isso troca a prop `cid` do hook enquanto o
  // envio (com o id já certo via override) está em andamento para a mesma conversa.
  it('não deixa o fetch disparado pela troca de conversationId apagar a mensagem otimista', async () => {
    // Backend só tem o turno persistido depois que o stream termina (`done`) —
    // antes disso, getConversation ainda devolveria o histórico vazio.
    let turnDone = false;
    vi.mocked(getConversation).mockImplementation(async () => ({
      success: true,
      data: {
        id: CONV,
        messages: turnDone
          ? [
              { id: 'm1', role: 'user', content: 'oi' },
              { id: 'm2', role: 'assistant', content: 'claro' },
            ]
          : [],
      },
    }) as unknown as ReturnType<typeof getConversation>);

    let finishStream!: (r: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise<Response>((resolve) => { finishStream = resolve; })),
    );

    const { result, rerender } = renderHook(
      ({ cid }: { cid: string }) => useAiStream(cid),
      { wrapper, initialProps: { cid: '' } },
    );

    let sendPromise!: Promise<void>;
    act(() => {
      sendPromise = result.current.sendMessage('oi', CONV);
    });

    // Simula o setConversationId(id) chegando num render seguinte, depois que a
    // mensagem otimista e o stream já começaram para CONV.
    rerender({ cid: CONV });

    // O efeito de "buscar ao montar/trocar conversationId" não deve correr enquanto
    // o próprio sendMessage já está streamando essa conversa — quem atualiza o
    // histórico ao final é o handler de `done`.
    expect(getConversation).not.toHaveBeenCalled();

    // Dá tempo para qualquer fetch indevido resolver: se existisse, teria sobrescrito
    // a lista com o histórico (ainda vazio nesse ponto).
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.messages.some((m) => m.role === 'user' && m.content === 'oi')).toBe(true);

    turnDone = true;
    finishStream(sseResponse([{ type: 'done' }]));
    await act(async () => {
      await sendPromise;
    });

    expect(result.current.messages.some((m) => m.role === 'user' && m.content === 'oi')).toBe(true);
    expect(result.current.messages.some((m) => m.role === 'assistant' && m.content === 'claro')).toBe(true);
  });
});

describe('useAiStream — eventos de texto, reasoning, tool_call e approval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConversation).mockResolvedValue({
      success: true,
      data: { id: CONV, messages: [] },
    } as unknown as Awaited<ReturnType<typeof getConversation>>);
  });

  it('acumula texto e reasoning conforme os frames chegam', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          { type: 'reasoning', text: 'pensando' },
          { type: 'text', text: 'ol' },
          { type: 'text', text: 'á' },
        ]),
      ),
    );

    const { result } = renderHook(() => useAiStream(CONV), { wrapper });

    await act(async () => {
      await result.current.sendMessage('oi');
    });

    expect(result.current.reasoning).toBe('pensando');
    // `done` nunca chegou neste stream — pendingText fica com o que já acumulou.
    expect(result.current.pendingText).toBe('olá');
  });

  it('registra uma tool_call sem resultado ainda e não dispara invalidação', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([{ type: 'tool_call', toolCallId: 't1', name: 'search', input: { q: 'x' } }]),
      ),
    );

    const { result } = renderHook(() => useAiStream(CONV), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      await result.current.sendMessage('busca algo');
    });

    expect(result.current.toolEvents).toEqual([{ id: 't1', name: 'search', input: { q: 'x' }, result: undefined }]);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('expõe a aprovação pendente quando o backend pede approval_required', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([{ type: 'approval_required', toolCallId: 't1', scope: 'fs.write' }]),
      ),
    );

    const { result } = renderHook(() => useAiStream(CONV), { wrapper });

    await act(async () => {
      await result.current.sendMessage('escreve um arquivo');
    });

    expect(result.current.pendingApproval).toEqual({ toolCallId: 't1', scope: 'fs.write' });
  });

  it('seta o erro, para o streaming e resincroniza com o checkpoint quando o backend manda error', async () => {
    vi.mocked(getConversation).mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(sseResponse([{ type: 'error', message: 'falhou no backend' }])),
    );

    const { result } = renderHook(() => useAiStream(CONV), { wrapper });
    await waitFor(() => expect(getConversation).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.sendMessage('oi');
    });

    expect(result.current.error).toBe('falhou no backend');
    expect(result.current.isStreaming).toBe(false);
    // Uma vez pelo mount, outra pelo handler de erro.
    expect(getConversation).toHaveBeenCalledTimes(2);
  });
});

describe('useAiStream — resolveApproval e stopStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConversation).mockResolvedValue({
      success: true,
      data: { id: CONV, messages: [] },
    } as unknown as Awaited<ReturnType<typeof getConversation>>);
  });

  it('resolveApproval limpa a aprovação pendente e consome o stream de approvals', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([{ type: 'done' }]));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAiStream(CONV), { wrapper });

    await act(async () => {
      await result.current.resolveApproval('t1', 'once');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/agent/${CONV}/approvals`,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"toolCallId":"t1"'),
      }),
    );
    expect(result.current.pendingApproval).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it('stopStream aborta o fetch em andamento e limpa isStreaming', async () => {
    const abortSpy = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, init: RequestInit) => {
        init.signal?.addEventListener('abort', abortSpy);
        return new Promise(() => {});
      }),
    );

    const { result } = renderHook(() => useAiStream(CONV), { wrapper });

    act(() => {
      result.current.sendMessage('oi');
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    act(() => {
      result.current.stopStream();
    });

    expect(abortSpy).toHaveBeenCalled();
    expect(result.current.isStreaming).toBe(false);
  });
});

describe('useAiStream — erros de rede e HTTP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConversation).mockResolvedValue({
      success: true,
      data: { id: CONV, messages: [] },
    } as unknown as Awaited<ReturnType<typeof getConversation>>);
  });

  it.each([
    [401, 'errorUnauthorized'],
    [403, 'errorForbidden'],
    [429, 'errorRateLimited'],
    [500, 'errorServer'],
    [418, 'errorGeneric'],
  ])('mapeia status HTTP %i para a chave %s quando o corpo vem vazio', async (status, key) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status, text: async () => '' } as unknown as Response),
    );

    const { result } = renderHook(() => useAiStream(CONV), { wrapper });

    await act(async () => {
      await result.current.sendMessage('oi');
    });

    expect(result.current.error).toBe(key);
    expect(result.current.isStreaming).toBe(false);
  });

  it('usa o corpo da resposta como mensagem de erro quando o backend manda texto', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'deu ruim' } as unknown as Response),
    );

    const { result } = renderHook(() => useAiStream(CONV), { wrapper });

    await act(async () => {
      await result.current.sendMessage('oi');
    });

    expect(result.current.error).toBe('deu ruim');
  });

  it('ignora silenciosamente um AbortError real (DOMException), como o que `fetch` rejeita ao abortar', async () => {
    const abortError = new DOMException('aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    const { result } = renderHook(() => useAiStream(CONV), { wrapper });

    await act(async () => {
      await result.current.sendMessage('oi');
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it('ignora silenciosamente um AbortError que já seja uma instância de Error (ex: polyfill)', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    const { result } = renderHook(() => useAiStream(CONV), { wrapper });

    await act(async () => {
      await result.current.sendMessage('oi');
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it('cai para errorNetwork quando o fetch rejeita com um erro de rede genérico', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const { result } = renderHook(() => useAiStream(CONV), { wrapper });

    await act(async () => {
      await result.current.sendMessage('oi');
    });

    expect(result.current.error).toBe('errorNetwork');
    expect(result.current.isStreaming).toBe(false);
  });
});

describe('useAiStream — fetchMessages ao montar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não atualiza as mensagens quando getConversation falha', async () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getConversation).mockResolvedValue({
      success: false,
      message: 'boom',
    } as unknown as Awaited<ReturnType<typeof getConversation>>);

    const { result } = renderHook(() => useAiStream(CONV), { wrapper });

    await waitFor(() => expect(getConversation).toHaveBeenCalledTimes(1));
    expect(result.current.messages).toEqual([]);
    expect(consoleErr).toHaveBeenCalledWith('Failed to fetch messages:', 'boom');
    consoleErr.mockRestore();
  });

  it('não busca mensagens quando conversationId é vazio', () => {
    renderHook(() => useAiStream(''), { wrapper });

    expect(getConversation).not.toHaveBeenCalled();
  });
});
