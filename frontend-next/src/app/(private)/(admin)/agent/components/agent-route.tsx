'use client';

import { useAgentChat } from '@/components/agent/agent-chat-provider';
import ChatView from '@/components/agent/chat-view';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';

/** Corpo da rota `/agent`; só o modo do chat é estado de cliente. */
export function AgentRoute() {
  const { t } = useTranslation('agent');
  const { mode, setMode } = useAgentChat();

  // The chat lives in a floating window — don't render a second instance on the route.
  if (mode === 'window') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <p className="text-muted-foreground">{t('chatInWindowMode')}</p>
        <Button onClick={() => setMode('route')}>{t('bringBack')}</Button>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0">
      <ChatView />
    </div>
  );
}
