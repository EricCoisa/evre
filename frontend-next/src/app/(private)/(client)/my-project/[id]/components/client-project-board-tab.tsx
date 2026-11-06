'use client';

import { ProjectBoard } from '@/components/project/project-board';

export function ClientProjectBoardTab({ projectId }: { projectId: string }) {
  return <ProjectBoard projectId={projectId} canEdit={false} mode="client" />;
}
