'use client';

import { ProjectInfoRequestsView } from '@/components/project/project-info-requests-view';

export function ProjectInfoRequestsTab({
  projectId,
  mode = 'admin',
}: {
  projectId: string;
  mode?: 'admin' | 'client';
}) {
  return <ProjectInfoRequestsView projectId={projectId} mode={mode} />;
}
