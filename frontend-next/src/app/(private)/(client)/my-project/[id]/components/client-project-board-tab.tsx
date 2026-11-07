'use client';

import { ProjectBoard } from '@/components/project/project-board';

export function ClientProjectBoardTab({
  projectId,
  initialTaskId,
}: {
  projectId: string;
  initialTaskId?: string;
}) {
  return (
    <ProjectBoard
      projectId={projectId}
      canEdit={false}
      mode="client"
      initialTaskId={initialTaskId}
    />
  );
}

