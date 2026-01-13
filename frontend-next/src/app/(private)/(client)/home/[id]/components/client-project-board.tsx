'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Loader2, LayoutGrid, Rows3 } from 'lucide-react';
import { useProject, useStagesByProject } from '@/lib/actions/project/queries';
import { useTranslation } from '@/hooks/use-translation';
import { ClientStageColumn } from './stageView/client-stage-column';
import { CommentModal } from './comment-modal';
import { cn } from '@/lib/utils';
import { StageView } from './stageView/stageView';
import { StatusView } from './statusView/statusView';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ClientProjectBoardProps {
  projectId: string;
}

const viewModes = ["STAGE", "STATUS"];

export function ClientProjectBoard({ projectId }: ClientProjectBoardProps) {
  const { t } = useTranslation('projects');
  const [showComments, setShowComments] = useState(false);

  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: stages, isLoading: stagesLoading } = useStagesByProject(projectId, {
    pagination: false,
  });

  const [progress, setProgress] = useState<{ stageId: string, value: number }[]>([]);


  const stageList = useMemo(
    () => (Array.isArray(stages) ? stages : stages?.data || []),
    [stages]
  );

  const [mode, setMode] = useState<string>(viewModes[0]);

  const handleChangeViewMode = (value: string) => {
    setMode(value);
  }


  if (projectLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('projectNotFound')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 overflow-hidden">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <CardTitle className="text-2xl">{project.name}</CardTitle>
                {project.description && (
                  <p className="text-sm text-muted-foreground">{project.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-sm',
                    project.status === 'DONE' && 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                    project.status === 'DOING' && 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
                    project.status === 'TODO' && 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  )}
                >
                  {project.status}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowComments(true)}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  {t('comments')}
                </Button>
                <div>
                  {mode === "STAGE" ? (
                    <LayoutGrid className='cursor-pointer' onClick={() => handleChangeViewMode("STATUS")} />
                  ) : (
                    <Rows3 className='cursor-pointer' onClick={() => handleChangeViewMode("STAGE")} />
                  )}
                </div>
                <div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('progress')}</span>
                <span className="font-medium">{progress.reduce((acc, cur) => acc + cur.value, 0) / (progress.length || 1)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${progress.reduce((acc, cur) => acc + cur.value, 0) / (progress.length || 1)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Board */}
        {mode === "STAGE" ? (
          <StageView
            projectId={projectId}
            project={project}
            stages={stageList}
            setProgress={setProgress}
          />
        ) : (
          <StatusView
            projectId={projectId}
            stages={stageList}
            setProgress={setProgress}
          />
        )}

        <CommentModal
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          entityType="PROJECT"
          entityId={projectId}
          projectId={projectId}
          entityName={project.name}
        />
      </div>

    </>
  );
}
