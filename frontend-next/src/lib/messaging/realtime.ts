import { API_PATHS } from '@/lib/generated/paths';

/** O que mudou, sem conteúdo: a tela só decide qual consulta refazer. `presence` é a exceção: estado efêmero. */
export type MessagingRealtimeEvent =
  | { type: 'connection' | 'messages' | 'contacts' | 'templates' }
  | {
      type: 'presence';
      connectionId: string;
      phone: string;
      state: 'COMPOSING' | 'RECORDING' | 'PAUSED';
    };

export const MESSAGING_EVENTS_PATH = `/api${API_PATHS.MESSAGING_EVENTS}`;

/** Primeira espera ao recomeçar quando o stream morre de vez (proxy derrubou, backend fora). */
const RECONNECT_MS = 5000;
/** Teto do backoff: backend fora do ar não vira loop de requisições. */
const MAX_RECONNECT_MS = 60_000;
/** Sessão morta: reconectar só devolve o mesmo erro, quem renova ou desloga é o resto do app. */
const FATAL_STATUSES = [401, 403];

type Handlers = {
  onEvent: (event: MessagingRealtimeEvent) => void;
  /** Conectou (ou reconectou): eventos do intervalo podem ter se perdido. */
  onOpen: () => void;
};

const subscribers = new Set<Handlers>();
let source: EventSource | null = null;
let connected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = RECONNECT_MS;
let probe: AbortController | null = null;

/** Sonda o endpoint antes de reabrir o EventSource: 401/403 para, 429/5xx/rede espera, 200 reabre. */
function scheduleReconnect() {
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (subscribers.size === 0) return;
    const controller = new AbortController();
    probe = controller;
    try {
      const res = await fetch(MESSAGING_EVENTS_PATH, {
        headers: { Accept: 'text/event-stream' },
        cache: 'no-store',
        signal: controller.signal,
      });
      controller.abort(); // só interessa o status; o stream de verdade é o do EventSource
      if (probe !== controller) return; // cancelado enquanto esperava
      probe = null;
      // Para por aqui; um assinante novo (tela montada depois) tenta de novo.
      if (FATAL_STATUSES.includes(res.status)) return;
      if (res.ok) {
        open();
        return;
      }
    } catch {
      if (probe !== controller) return;
      probe = null;
    }
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_MS);
    scheduleReconnect();
  }, reconnectDelay);
}

function open() {
  source = new EventSource(MESSAGING_EVENTS_PATH);

  source.onopen = () => {
    connected = true;
    reconnectDelay = RECONNECT_MS;
    subscribers.forEach((s) => s.onOpen());
  };

  source.onmessage = (message) => {
    try {
      const raw = JSON.parse(message.data as string) as { type: string };
      // Fim de vida do stream (não é falha): reconecta na hora, sem o backoff de erro.
      if (raw.type === 'end') {
        close();
        open();
        return;
      }
      subscribers.forEach((s) => s.onEvent(raw as MessagingRealtimeEvent));
    } catch {
      // Evento fora do formato: ignora, o próximo conserta.
    }
  };

  source.onerror = () => {
    connected = false;
    // CLOSED = o navegador desistiu (erro HTTP). Em erro de rede ele mesmo reconecta (CONNECTING).
    if (source?.readyState === EventSource.CLOSED) {
      source = null;
      scheduleReconnect();
    }
  };
}

function close() {
  source?.close();
  source = null;
  connected = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  probe?.abort();
  probe = null;
}

/** Mantém uma conexão por aba, abrindo no primeiro assinante e fechando no último; devolve a função de cancelamento. */
export function subscribeMessagingRealtime(handlers: Handlers): () => void {
  if (typeof EventSource === 'undefined') return () => undefined;
  subscribers.add(handlers);
  if (!source && !reconnectTimer && !probe) {
    // Nova tela montada depois de uma sessão morta: tenta de novo uma vez.
    reconnectDelay = RECONNECT_MS;
    open();
  } else if (connected) handlers.onOpen();

  return () => {
    subscribers.delete(handlers);
    if (subscribers.size === 0) close();
  };
}
