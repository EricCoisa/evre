'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ProjectBoard } from '@/components/project/project-board';

export function ProjectBoardTab({
  projectId,
  initialTaskId,
  canEdit = true,
  mode = 'admin',
}: {
  projectId: string;
  initialTaskId?: string;
  canEdit?: boolean;
  mode?: 'admin' | 'client';
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleGoToRequests = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'info-requests');
    router.replace(`/project/${projectId}?${params.toString()}`, { scroll: false });
  };

  return (
    <ProjectBoard
      projectId={projectId}
      canEdit={canEdit}
      mode={mode}
      initialTaskId={initialTaskId}
      onGoToRequests={handleGoToRequests}
    />
  );
}
