import { serverCanAccessRoute, serverFeatureFlag } from '@/lib/server-context';
import { AgentWindowChat } from './agent-window-chat';

/** Janela flutuante do agente; renderiza só quando a feature flag e o acesso à rota permitem. */
export async function AgentWindow() {
  const [enabled, canReachRoute] = await Promise.all([
    serverFeatureFlag('AI_AGENT'),
    serverCanAccessRoute('/agent'),
  ]);

  if (!enabled || !canReachRoute) return null;

  return <AgentWindowChat />;
}
