'use client';

import { useProjectBoard } from '@/lib/actions/project/queries';
import { useTranslation } from '@/hooks/use-translation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Milestone {
  id: string;
  title: string;
  position: number;
  tasks: Task[];
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  position: number;
}

export function ClientProjectBoardTab({ projectId }: { projectId: string }) {
  const { t } = useTranslation('project');
  const { data: boardData, isLoading } = useProjectBoard(projectId);

  const milestones: Milestone[] = boardData?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="min-w-[280px]">
            <Skeleton className="h-[300px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (milestones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {t('empty')}
      </p>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {milestones.map((milestone) => (
        <Card
          key={milestone.id}
          className="min-w-[280px] max-w-[320px] flex-shrink-0 bg-muted/30"
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {milestone.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {milestone.tasks.map((task) => (
              <Card key={task.id} className="shadow-sm">
                <CardContent className="p-3">
                  <span className="text-sm">{task.title}</span>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
            {milestone.tasks.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                —
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
