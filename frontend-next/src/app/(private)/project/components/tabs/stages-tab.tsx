'use client';

import { Project, Stage, StageStatus } from '@/lib/actions/project/types';
import { useStages, useCreateStage, useCreateApproval } from '@/lib/actions/project/queries';
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

  const { data: stagesData } = useStages({ filter: { projectId: project.id }, pagination: false });
  const createStage = useCreateStage();
  const createApproval = useCreateApproval();
  
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

  // Schema e config para criar Approval
  const createApprovalSchema = useMemo(() =>
    z.object({
      stageId: z.string().min(1, t('stageRequired')),
      status: z.enum(['APPROVED', 'REJECTED']),
      comment: z.string().optional(),
    }),
  [t]);

  const approvalFieldConfig = useMemo(() => ({
    stageId: {
      label: t('stage'),
      placeholder: t('selectStage'),
      type: 'select' as const,
      options: stages.map((stage) => ({
        value: stage.id,
        label: stage.name,
      })),
    },
    status: {
      label: t('status'),
      type: 'select' as const,
      options: [
        { value: 'APPROVED', label: t('approved') },
        { value: 'REJECTED', label: t('rejected') },
      ],
    },
    comment: {
      label: t('approvalComment'),
      placeholder: t('approvalCommentPlaceholder'),
      type: 'textarea' as const,
    },
  } satisfies FieldConfig<typeof createApprovalSchema>), [t, stages]);

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
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && stages.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle><LangLabel text="addApproval" langJson="projects" /></CardTitle>
              <GenericCreateFormModal
                trigger={
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('addApproval')}
                  </Button>
                }
                closeOnsuccess={true}
                title={t('addApproval')}
                description={t('addApprovalDescription')}
                schema={createApprovalSchema}
                fieldConfig={approvalFieldConfig}
                onSubmit={async (data) => {
                  await createApproval.mutateAsync({
                    projectId: project.id,
                    entityType: 'STAGE',
                    entityId: data.stageId,
                    status: data.status,
                    comment: data.comment,
                  });
                }}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['approvals'] });
                }}
                submitLabel={t('create')}
                defaultValues={{
                  status: 'APPROVED',
                }}
              />
            </div>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
