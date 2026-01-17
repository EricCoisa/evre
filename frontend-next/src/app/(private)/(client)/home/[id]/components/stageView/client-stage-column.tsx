'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Loader2 } from 'lucide-react';
import { useActivitiesByStage, useStageApprovalState } from '@/lib/actions/project/queries';
import { ClientActivityCard } from './client-activity-card';
import { CommentModal } from '../comment-modal';
import { StageApprovalButton } from './stage-approval-button';
import { ApprovalStatusBadge } from '@/components/approval-status-badge';
import type { Stage } from '@/lib/actions/project/types';

interface ClientStageColumnProps {
  stage: Stage;
  projectId: string;
  projectName: string;
  setProgress?: React.Dispatch<React.SetStateAction<{stageId: string, value: number}[]>>;
}

export function ClientStageColumn({ stage, projectId, projectName, setProgress }: ClientStageColumnProps) {
  const [showComments, setShowComments] = useState(false);

  const { data: activities, isLoading } = useActivitiesByStage(stage.id, {
    pagination: false,
  });

  // Buscar estado de aprovação
  const { data: approvalState } = useStageApprovalState(stage.id);

  const activityList = Array.isArray(activities) ? activities : activities?.data || [];
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
      <Card className="shrink-0 w-80 flex flex-col">
        <CardHeader className="pb-3 space-y-2">
          {/* Barra de progresso */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Progresso</span>
              <span>
                {doneActivities}/{totalActivities}
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-2 bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-base line-clamp-2">{stage.name}</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowComments(true)}
              className="h-8 px-2 shrink-0"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>

          {/* Badge de Status de Aprovação */}
          <ApprovalStatusBadge 
            approvalState={approvalState} 
            showComment={true}
          />

          <StageApprovalButton
            stageId={stage.id}
            stageName={stage.name}
            projectId={projectId}
            projectName={projectName}
          />
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto space-y-3 pb-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activityList.length > 0 ? (
            activityList.map((activity) => (
              <ClientActivityCard
                key={activity.id}
                activity={activity}
                projectId={projectId}
              />
            ))
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma atividade
            </div>
          )}
        </CardContent>
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
