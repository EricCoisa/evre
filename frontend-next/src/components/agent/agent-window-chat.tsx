"use client";

import { MessageCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAgentChat } from '@/components/agent/agent-chat-provider';
import { Window } from '@/components/window';
import ChatView from '@/components/agent/chat-view';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { useHasMounted } from '@/hooks/use-has-mounted';

export function AgentWindowChat() {
  const { mode, setMode } = useAgentChat();
  const { t } = useTranslation('agent');
  const mounted = useHasMounted();
  const pathname = usePathname();

  if (!mounted) return null;

  if (mode !== 'window') {
    // Na própria rota do agente o chat já está na tela — o balão não tem o que abrir.
    if (pathname?.startsWith('/agent')) return null;
    return (
      <Button
        size="icon-lg"
        aria-label={t('chatWithAI')}
        title={t('chatWithAI')}
        onClick={() => setMode('window')}
        className="fixed bottom-6 right-4 sm:right-6 z-40 size-12 sm:size-14 cursor-pointer rounded-full shadow-lg"
      >
        <MessageCircle className="size-5 sm:size-6" />
      </Button>
    );
  }

  return (
    <Window
      title={t('agentTitle')}
      name="agent-chat-window"
      setClosed={() => setMode('route')}
    >
      <ChatView compact />
    </Window>
  );
}
