'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { Stage } from '@/lib/actions/project/types';
import { ClientStageStatusCard } from './client-stage-status-card';

interface StatusViewProps {
  stages: Stage[];
  projectId: string;
  setProgress?: React.Dispatch<React.SetStateAction<{stageId: string, value: number}[]>>;
}

export function StatusView({ projectId, stages, setProgress }: StatusViewProps) {
  const { t } = useTranslation('projects');

  return (
    <div className="space-y-4">
      {stages.length > 0 ? (
        stages.map((stage) => (
          <ClientStageStatusCard
            key={stage.id}
            stage={stage}
            projectId={projectId}
           setProgress={setProgress}
          />
        ))
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t('noStages')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
