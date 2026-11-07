import { Container } from '@/components/container';
import { PageHeader } from '@/components/page-header';
import LangLabel from '@/components/ui/langLabel';
import { TimeTrackerTab } from './components/time-tracker-tab';
import { serverFeatureFlag } from '@/lib/server-context';
import { notFound } from 'next/navigation';

/**
 * Server Component — Página de Rastreamento de Tempo (Time Tracking).
 *
 * Segue rigorosamente a convenção arquitetural de `docs/frontend/page-structure.md`:
 * - É um Server Component (sem `'use client'`).
 * - Valida a Feature Flag no servidor antes de enviar o payload.
 * - Utiliza <Container variant="dataTable" border={false}> e <PageHeader>.
 * - Tradução SSR via <LangLabel text="..." langJson="time-tracking" />.
 * - Toda a interatividade da tabela e modais fica isolada em `./components/time-tracker-tab.tsx`.
 */
export default async function TimeTrackerPage() {
  const isEnabled = await serverFeatureFlag('FEATURE_TIME_TRACKING');
  if (!isEnabled) {
    notFound();
  }

  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={<LangLabel text="title" langJson="time-tracking" />}
        description={<LangLabel text="description" langJson="time-tracking" />}
      />
      <TimeTrackerTab />
    </Container>
  );
}
