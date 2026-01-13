'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, MessageCircle } from 'lucide-react';
import { useActivitiesByStage } from '@/lib/actions/project/queries';
import { ClientActivityCard } from '../stageView/client-activity-card';
import { CommentModal } from '../comment-modal';
import { StageApprovalButton } from '../stageView/stage-approval-button';
import type { Stage } from '@/lib/actions/project/types';
import { cn } from '@/lib/utils';

interface ClientStageStatusCardProps {
  stage: Stage;
  projectId: string;
 setProgress?: React.Dispatch<React.SetStateAction<{stageId: string, value: number}[]>>;
}

export function ClientStageStatusCard({ 
  stage, 
  projectId, 
  setProgress 
}: ClientStageStatusCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const { data: activities, isLoading } = useActivitiesByStage(stage.id, {
    pagination: false,
  });

  const activityList = useMemo(
    () => (Array.isArray(activities) ? activities : activities?.data || []),
    [activities]
  );

  const groupedActivities = useMemo(() => {
    const groups = {
      TODO: activityList.filter((a) => a.status === 'TODO'),
      DOING: activityList.filter((a) => a.status === 'DOING'),
      DONE: activityList.filter((a) => a.status === 'DONE'),
    };
    return groups;
  }, [activityList]);

 
  const totalActivities = activityList.length;
  const doneActivities = activityList.filter((a) => a.status === 'DONE').length;
  const progress = totalActivities > 0 ? (doneActivities / totalActivities) * 100 : 0;

  useEffect(() => {
    if (setProgress) {
      setProgress((prev) => {
        const otherStages = prev?.filter(p => p.stageId !== stage.id) || [];
        return [...otherStages, { stageId: stage.id, value: progress }];
      });
    }
  }, [progress, setProgress]);

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 p-0 shrink-0"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-base">{stage.name}</h3>
                
                {/* Barra de progresso */}
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Progresso</span>
                    <span>
                      {groupedActivities.DONE.length}/{activityList.length}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowComments(true)}
                className="h-8 px-2 shrink-0"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Aprovação do Stage */}
          <div className="mt-2">
            <StageApprovalButton
              stageId={stage.id}
              stageName={stage.name}
              projectId={projectId}
            />
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Coluna TODO */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
                  <span className="text-sm font-medium">TODO</span>
                  <span className="text-xs text-muted-foreground">
                    {groupedActivities.TODO.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {groupedActivities.TODO.length > 0 ? (
                    groupedActivities.TODO.map((activity) => (
                      <ClientActivityCard
                        key={activity.id}
                        activity={activity}
                        projectId={projectId}
                      />
                    ))
                  ) : (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      Nenhuma atividade
                    </div>
                  )}
                </div>
              </div>

              {/* Coluna DOING */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded-md">
                  <span className="text-sm font-medium">DOING</span>
                  <span className="text-xs text-muted-foreground">
                    {groupedActivities.DOING.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {groupedActivities.DOING.length > 0 ? (
                    groupedActivities.DOING.map((activity) => (
                      <ClientActivityCard
                        key={activity.id}
                        activity={activity}
                        projectId={projectId}
                      />
                    ))
                  ) : (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      Nenhuma atividade
                    </div>
                  )}
                </div>
              </div>

              {/* Coluna DONE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 py-1 bg-green-100 dark:bg-green-900 rounded-md">
                  <span className="text-sm font-medium">DONE</span>
                  <span className="text-xs text-muted-foreground">
                    {groupedActivities.DONE.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {groupedActivities.DONE.length > 0 ? (
                    groupedActivities.DONE.map((activity) => (
                      <ClientActivityCard
                        key={activity.id}
                        activity={activity}
                        projectId={projectId}
                      />
                    ))
                  ) : (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      Nenhuma atividade
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <CommentModal
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        entityType="STAGE"
        entityId={stage.id}
        projectId={projectId}
        entityName={stage.name}
      />
    </>
  );
}
