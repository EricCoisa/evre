import { useEffect, useRef, useState } from 'react';
import { subscribeMessagingRealtime } from '@/lib/messaging/realtime';

/** O WhatsApp some sozinho sem renovação em ~25s; aqui é mais curto para não ficar "preso" ligado. */
const TTL_MS = 10_000;

export type TypingIndicator = 'COMPOSING' | 'RECORDING' | null;

/** Indicador de UMA conversa (conexão + telefone); some sozinho se o PAUSED nunca chegar. */
export function useTypingIndicator(connectionId: string, phone: string): TypingIndicator {
  const [state, setState] = useState<TypingIndicator>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return subscribeMessagingRealtime({
      onOpen: () => undefined,
      onEvent: (event) => {
        if (event.type !== 'presence') return;
        if (event.connectionId !== connectionId || event.phone !== phone) return;
        if (timer.current) clearTimeout(timer.current);

        if (event.state === 'PAUSED') {
          setState(null);
          return;
        }
        setState(event.state);
        timer.current = setTimeout(() => setState(null), TTL_MS);
      },
    });
  }, [connectionId, phone]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return state;
}
