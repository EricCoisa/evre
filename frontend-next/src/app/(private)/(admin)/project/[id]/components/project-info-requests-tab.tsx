'use client';

import { ProjectInfoRequestsView } from '@/components/project/project-info-requests-view';

export function ProjectInfoRequestsTab({ projectId }: { projectId: string }) {
  return <ProjectInfoRequestsView projectId={projectId} mode="admin" />;
}
