'use client';

import { ProjectInfoRequestsView } from '@/components/project/project-info-requests-view';

export function ClientInfoRequestsTab({ projectId }: { projectId: string }) {
  return <ProjectInfoRequestsView projectId={projectId} mode="client" />;
}
