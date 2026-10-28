"use client";

import { useState, useEffect, createContext, useContext } from 'react';
import { useAiStream } from '@/lib/actions/ai/use-ai-stream';
import { useHasMounted } from '@/hooks/use-has-mounted';

interface AgentChatContext {
  mode: 'route' | 'window';
  setMode: (newMode: 'route' | 'window') => void;
  toggleMode: () => void;
  conversationId: string;
  setConversationId: (id: string) => void;
  model: string;
  setModel: (model: string) => void;
  stream: ReturnType<typeof useAiStream>;
}

const AgentChatContext = createContext<AgentChatContext | null>(null);

function AgentChatProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<'route' | 'window'>('route');
  const [conversationId, setConversationId] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const mounted = useHasMounted();

  useEffect(() => {
    // Restaura o modo salvo (localStorage só existe no client) — leitura única no mount,
    // sem equivalente idiomático fora de effect (não é um valor "vivo" que precise de subscribe).
    const saved = localStorage.getItem('agent-mode');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === 'window' || saved === 'route') setModeState(saved);
  }, []);

  const setMode = (newMode: 'route' | 'window') => {
    setModeState(newMode);
    if (mounted) localStorage.setItem('agent-mode', newMode);
  };

  const toggleMode = () => setMode(mode === 'route' ? 'window' : 'route');

  const stream = useAiStream(conversationId, model);

  return (
    <AgentChatContext.Provider value={{ mode, setMode, toggleMode, conversationId, setConversationId, model, setModel, stream }}>
      {children}
    </AgentChatContext.Provider>
  );
}

export function useAgentChat() {
  const context = useContext(AgentChatContext);
  if (!context) {
    throw new Error('useAgentChat must be used within an AgentChatProvider');
  }
  return context;
}

export default AgentChatProvider;
