import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  subscribeMessagingRealtime,
  type MessagingRealtimeEvent,
} from '@/lib/messaging/realtime';

/** Qual consulta refazer para cada tipo de mudança. */
const QUERY_KEYS: Record<MessagingRealtimeEvent['type'], string[][]> = {
  connection: [
    ['messaging', 'connections'],
    ['messaging', 'session'],
    ['messaging', 'health'],
  ],
  messages: [['messaging', 'messages']],
  contacts: [['messaging', 'contacts']],
  // Decisão de aprovação de template (webhook da Meta ou verificação manual).
  templates: [['messaging', 'templates']],
  // Efêmero, nunca refaz consulta — ver useTypingIndicator.
  presence: [],
};

/** Eventos em rajada (webhook de histórico, status de vários envios) viram uma única rodada de consultas. */
const DEBOUNCE_MS = 750;

type Binding = { users: number; stop: () => void };

/** Mantém um único assinante por QueryClient, independente do número de componentes usando o hook. */
const bindings = new WeakMap<QueryClient, Binding>();

function bind(queryClient: QueryClient): Binding {
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    const keys = [...pending].map((k) => JSON.parse(k) as string[]);
    pending.clear();
    // ['messaging'] já cobre todas as outras.
    const roots = keys.some((k) => k.length === 1) ? [['messaging']] : keys;
    for (const queryKey of roots) void queryClient.invalidateQueries({ queryKey });
  };

  const schedule = (keys: string[][]) => {
    for (const key of keys) pending.add(JSON.stringify(key));
    timer ??= setTimeout(flush, DEBOUNCE_MS);
  };

  const unsubscribe = subscribeMessagingRealtime({
    onEvent: (event) => schedule(QUERY_KEYS[event.type] ?? []),
    // Ao (re)conectar, eventos do intervalo podem ter se perdido: refaz tudo uma vez.
    onOpen: () => schedule([['messaging']]),
  });

  return {
    users: 0,
    stop: () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    },
  };
}

/** Invalida as consultas de mensageria certas quando o backend avisa uma mudança por push. */
export function useMessagingRealtime(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const binding = bindings.get(queryClient) ?? bind(queryClient);
    bindings.set(queryClient, binding);
    binding.users += 1;

    return () => {
      binding.users -= 1;
      if (binding.users === 0) {
        binding.stop();
        bindings.delete(queryClient);
      }
    };
  }, [queryClient, enabled]);
}
