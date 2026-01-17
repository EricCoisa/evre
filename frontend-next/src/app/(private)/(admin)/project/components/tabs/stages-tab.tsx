'use client';

import { Project, Stage, StageStatus } from '@/lib/actions/project/types';
import { useStages, useCreateStage, useStagesByProject } from '@/lib/actions/project/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import type { FieldConfig } from '@/lib/form/field-config';
import { GenericCreateFormModal } from '@/components/generic-create-form';
import LangLabel from '@/components/ui/langLabel';

import { useTranslation } from '@/hooks/use-translation';
import { StageItem } from './stage-item';

interface StagesTabProps {
  project: Project;
  isAdmin?: boolean;
}

export function StagesTab({ project, isAdmin = false }: StagesTabProps) {
  const { t } = useTranslation('projects');
  const queryClient = useQueryClient();

  const { data: stagesData } = useStagesByProject(project.id, { filter: { projectId: project.id }, pagination: false });
  const createStage = useCreateStage();

  const stages = useMemo(() =>
    Array.isArray(stagesData) ? stagesData : stagesData?.data || [],
    [stagesData]);

  // Schema e config para criar Stage
  const createStageSchema = useMemo(() =>
    z.object({
      name: z.string().min(1, t('stageNameRequired')),
    }),
    [t]);

  const stageFieldConfig = useMemo(() => ({
    name: {
      label: t('stageName'),
      placeholder: t('stageNamePlaceholder'),
    },
  } satisfies FieldConfig<typeof createStageSchema>), [t]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle><LangLabel text="stages" langJson="projects" /></CardTitle>
            {isAdmin && (
              <GenericCreateFormModal
                trigger={
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('addStage')}
                  </Button>
                }
                closeOnsuccess={true}
                title={t('addStage')}
                description={t('addStageDescription')}
                schema={createStageSchema}
                fieldConfig={stageFieldConfig}
                onSubmit={async (data) => {
                  await createStage.mutateAsync({
                    ...data,
                    projectId: project.id,
                    order: 0, // Será calculado automaticamente no backend
                  });
                }}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['stages'] });
                }}
                submitLabel={t('create')}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {stages.length === 0 ? (
            <p className="text-muted-foreground">{t('noStages')}</p>
          ) : (
            <div className="space-y-4">
              {stages.map((stage, index) => (
                <StageItem
                  key={stage.id}
                  stage={stage}
                  isAdmin={isAdmin}
                  stages={stages}
                  stageIndex={index}
                  totalStages={stages.length}
                  project={project}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
