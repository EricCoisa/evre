import { redirect } from 'next/navigation';
import { serverFeatureFlag } from '@/lib/server-context';
import { AgentRoute } from './components/agent-route';

/** Server Component: com `AI_AGENT` desligada o usuário é desviado antes de qualquer byte do chat. */
export default async function AgentPage() {
  if (!(await serverFeatureFlag('AI_AGENT'))) redirect('/home');

  return <AgentRoute />;
}
