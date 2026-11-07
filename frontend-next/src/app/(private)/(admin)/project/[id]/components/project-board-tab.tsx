'use client';

import { ProjectBoard } from '@/components/project/project-board';

export function ProjectBoardTab({
  projectId,
  initialTaskId,
}: {
  projectId: string;
  initialTaskId?: string;
}) {
  return (
    <ProjectBoard
      projectId={projectId}
      canEdit={true}
      mode="admin"
      initialTaskId={initialTaskId}
    />
  );
}

