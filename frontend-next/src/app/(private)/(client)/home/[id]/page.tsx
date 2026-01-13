'use server';

import { ClientProjectBoard } from './components/client-project-board';

export default async function ClientProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
      <ClientProjectBoard projectId={id} />
  );
}
