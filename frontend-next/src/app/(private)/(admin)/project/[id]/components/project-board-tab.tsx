'use client';

import { ProjectBoard } from '@/components/project/project-board';

export function ProjectBoardTab({ projectId }: { projectId: string }) {
  return <ProjectBoard projectId={projectId} canEdit={true} mode="admin" />;
}
