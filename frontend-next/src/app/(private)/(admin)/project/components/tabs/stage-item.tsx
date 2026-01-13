'use client';

import { Stage, ApprovalStatusColors, Approval, StageStatus } from '@/lib/actions/project/types';
import { useActivitiesByStage, useApprovalsByStage, useActivityStatus, useUpdateStage, useCreateActivity, useStageStatus, useUpdateStageStatus } from '@/lib/actions/project/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, ChevronUp, ChevronDown } from 'lucide-react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import type { FieldConfig } from '@/lib/form/field-config';
import { GenericCreateFormModal, GenericCreateForm } from '@/components/generic-create-form';
import LangLabel from '@/components/ui/langLabel';
import { SortableActivitiesList } from '../sortable-activities-list';
import Modal from '@/components/modal';
import { useTranslation } from '@/hooks/use-translation';

interface StageItemProps {
  stage: Stage;
  isAdmin: boolean;
  stages: Stage[];
  stageIndex: number;
  totalStages: number;
}

export function StageItem({ 
  stage, 
  isAdmin, 
  stages, 
  stageIndex, 
  totalStages 
}: StageItemProps) {
  const { t } = useTranslation('projects');
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const { data: activitiesData } = useActivitiesByStage(stage.id, { 
    pagination: false 
  });
  const { data: approvalsData } = useApprovalsByStage(stage.id);
  const { data: activityStatusList } = useActivityStatus();
  const { data: stageStatuses } = useStageStatus();
  const createActivity = useCreateActivity();
  const updateStage = useUpdateStage();
  const updateStageStatus = useUpdateStageStatus();

  const activities = Array.isArray(activitiesData) ? activitiesData : activitiesData?.data || [];
  const approvals = approvalsData || [];

  // Schema e config para editar Stage
  const updateStageSchema = useMemo(() =>
    z.object({
      name: z.string().min(1, t('stageNameRequired')),
    }),
  [t]);

  const stageFieldConfig = useMemo(() => ({
    name: {
      label: t('stageName'),
      placeholder: t('stageNamePlaceholder'),
    },
  } satisfies FieldConfig<typeof updateStageSchema>), [t]);

  // Schema e config para criar Activity
  const createActivitySchema = useMemo(() =>
    z.object({
      title: z.string().min(1, t('activityTitleRequired')),
      description: z.string().optional(),
      status: z.string().optional(),
    }),
  [t]);

  const activityFieldConfig = useMemo(() => ({
    title: {
      label: t('activityTitle'),
      placeholder: t('activityTitlePlaceholder'),
    },
    description: {
      label: t('activityDescription'),
      placeholder: t('activityDescriptionPlaceholder'),
      type: 'textarea' as const,
    },
    status: {
      label: t('status'),
      type: 'select' as const,
      options: activityStatusList?.map(status => ({
        value: status,
        label: status,
      })) || [],
    },
  } satisfies FieldConfig<typeof createActivitySchema>), [t, activityStatusList]);

  const handleUpdateStageSubmit = useCallback(async (data: z.infer<typeof updateStageSchema>) => {
    await updateStage.mutateAsync({
      id: stage.id,
      data,
    });
  }, [stage.id, updateStage]);

  const handleUpdateStageSuccess = useCallback(() => {
    setIsEditModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ['stages'] });
    toast.success(t('stageUpdated'));
  }, [queryClient, t]);

  const handleMoveStage = useCallback(async (direction: 'up' | 'down') => {
    try {
      const currentIndex = stageIndex;
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      
      if (targetIndex < 0 || targetIndex >= totalStages) return;

      const currentStage = stages[currentIndex];
      const targetStage = stages[targetIndex];

      // Trocar as ordens
      await Promise.all([
        updateStage.mutateAsync({
          id: currentStage.id,
          data: { order: targetStage.order },
        }),
        updateStage.mutateAsync({
          id: targetStage.id,
          data: { order: currentStage.order },
        }),
      ]);

      queryClient.invalidateQueries({ queryKey: ['stages'] });
      toast.success(t('stageOrderUpdated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error updating stage order');
    }
  }, [stageIndex, totalStages, stages, updateStage, queryClient, t]);

  const handleStageStatusChange = useCallback(async (status: StageStatus) => {
    try {
      await updateStageStatus.mutateAsync({ id: stage.id, status });
      queryClient.invalidateQueries({ queryKey: ['stages'] });
      toast.success(t('statusUpdated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error updating status');
    }
  }, [stage.id, updateStageStatus, queryClient, t]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{stage.name}</CardTitle>
              <Badge variant="outline">Order: {stage.order}</Badge>
              {isAdmin ? (
                <Select value={stage.status} onValueChange={handleStageStatusChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue>
                      <Badge variant="outline">{stage.status}</Badge>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(stageStatuses || []).map((status) => (
                      <SelectItem key={status} value={status}>
                        <Badge variant="outline">{status}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline">{stage.status}</Badge>
              )}
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleMoveStage('up')}
                  disabled={stageIndex === 0}
                  className="h-8 w-8 p-0"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleMoveStage('down')}
                  disabled={stageIndex === totalStages - 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditModalOpen(true)}
                  className="h-8 w-8 p-0"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium"><LangLabel text="activities" langJson="projects" /></p>
              {isAdmin && (
                <GenericCreateFormModal
                  trigger={
                    <Button size="sm" variant="outline">
                      <Plus className="mr-2 h-3 w-3" />
                      {t('addActivity')}
                    </Button>
                  }
                  closeOnsuccess={true}
                  title={t('addActivity')}
                  description={t('addActivityDescription')}
                  schema={createActivitySchema}
                  fieldConfig={activityFieldConfig}
                  onSubmit={async (data) => {
                    await createActivity.mutateAsync({
                      ...data,
                      stageId: stage.id,
                    });
                  }}
                  onSuccess={() => {
                    queryClient.invalidateQueries({ 
                      queryKey: ['activities', 'stage', stage.id]
                    });
                  }}
                  submitLabel={t('create')}
                  defaultValues={{
                    status: 'TODO',
                  }}
                />
              )}
            </div>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noActivities')}</p>
            ) : (
              <SortableActivitiesList activities={activities} stageId={stage.id} isAdmin={isAdmin} />
            )}
          </div>

          <div>
            <p className="text-sm font-medium mb-2"><LangLabel text="approvals" langJson="projects" /></p>
            {approvals.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noApprovals')}</p>
            ) : (
              <div className="space-y-2">
                {approvals.map((approval: Approval) => (
                  <div key={approval.id} className="flex items-start justify-between text-sm">
                    <div>
                      <Badge className={ApprovalStatusColors[approval.status as keyof typeof ApprovalStatusColors]}>
                        {approval.status}
                      </Badge>
                      {approval.comment && (
                        <p className="text-muted-foreground mt-1">{approval.comment}</p>
                      )}
                    </div>
                    <span className="text-muted-foreground">{formatDate(approval.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Modal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        title={t('editStage')}
        description={t('editStageDescription')}
      >
        <GenericCreateForm
          schema={updateStageSchema}
          fieldConfig={stageFieldConfig}
          onSubmit={handleUpdateStageSubmit}
          onSuccess={handleUpdateStageSuccess}
          submitLabel={t('save')}
          cancelLabel={t('cancel')}
          onCancel={() => setIsEditModalOpen(false)}
          defaultValues={{
            name: stage.name,
          }}
        />
      </Modal>
    </>
  );
}
