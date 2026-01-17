'use client';

import { Stage, ApprovalStatusColors, Approval, StageStatus, Project } from '@/lib/actions/project/types';
import { useActivitiesByStage, useApprovalsByStage, useActivityStatus, useUpdateStage, useCreateActivity, useStageStatus, useUpdateStageStatus } from '@/lib/actions/project/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, ChevronUp, ChevronDown, MessageCircle, MessageSquare, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import type { FieldConfig } from '@/lib/form/field-config';
import { GenericCreateFormModal, GenericCreateForm } from '@/components/generic-create-form';
import LangLabel from '@/components/ui/langLabel';
import { SortableActivitiesList } from '../sortable-activities-list';
import Modal from '@/components/modal';
import { useTranslation } from '@/hooks/use-translation';
import { StageApprovalRequestButton } from '@/app/(private)/(admin)/project/components/stage-approval-request-button';
import { CommentModal } from '@/app/(private)/(client)/home/[id]/components/comment-modal';
import { useApprovalRequestsByStage } from '@/lib/actions/approval-request/queries';
import { useApprovalByRequest } from '@/lib/actions/project/queries';

interface StageItemProps {
  stage: Stage;
  isAdmin: boolean;
  stages: Stage[];
  stageIndex: number;
  totalStages: number;
  project: Project;
}

export function StageItem({ 
  stage, 
  isAdmin, 
  stages, 
  stageIndex, 
  totalStages,
  project
}: StageItemProps) {
  const { t } = useTranslation('projects');
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  
  const { data: activitiesData } = useActivitiesByStage(stage.id, { 
    pagination: false 
  });
  const { data: approvalsData } = useApprovalsByStage(stage.id);
  const { data: activityStatusList } = useActivityStatus();
  const { data: stageStatuses } = useStageStatus();
  const createActivity = useCreateActivity();
  const updateStage = useUpdateStage();
  const updateStageStatus = useUpdateStageStatus();

  // Buscar approval requests para este stage
  const { data: approvalRequestsData } = useApprovalRequestsByStage(stage.id);
  const approvalRequests = approvalRequestsData || [];
  const pendingRequest = approvalRequests.find(req => req.status === 'PENDING');
  
  // Buscar a aprovação correspondente se existir request pendente
  const { data: approval } = useApprovalByRequest(pendingRequest?.id || '');

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
                  onClick={() => setShowComments(true)}
                  className="h-8 w-8 p-0"
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
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
                <StageApprovalRequestButton
                  stageId={stage.id}
                  projectId={project.id}
                />
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
              <SortableActivitiesList 
                activities={activities} 
                stageId={stage.id} 
                isAdmin={isAdmin} 
                projectId={project.id}
              />
            )}
          </div>

          <div>
            <p className="text-sm font-medium mb-2"><LangLabel text="approvals" langJson="projects" /></p>
            
            {/* Approval Request Status */}
            {pendingRequest && (
              <div className="mb-3 p-3 border rounded-lg bg-blue-50 dark:bg-blue-950">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">{t('approvalRequested')}</span>
                  </div>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700">
                    {pendingRequest.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('requestedBy')}: {pendingRequest.requestedBy?.name || t('unknownUser')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(pendingRequest.createdAt.toString())}
                </p>
                
                {/* Client Response */}
                {approval && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      {approval.status === 'APPROVED' && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {approval.status === 'APPROVED_WITH_REMARKS' && <AlertCircle className="h-4 w-4 text-yellow-600" />}
                      {approval.status === 'REJECTED' && <XCircle className="h-4 w-4 text-red-600" />}
                      <Badge className={ApprovalStatusColors[approval.status]}>
                        {approval.status}
                      </Badge>
                    </div>
                    {approval.comment && (
                      <div className="flex items-start gap-2 text-sm bg-muted p-2 rounded mt-2">
                        <MessageSquare className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <p>{approval.comment}</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDate(approval.createdAt.toString())}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Historical Approvals */}
            {approvals.length === 0 && !pendingRequest ? (
              <p className="text-sm text-muted-foreground">{t('noApprovals')}</p>
            ) : approvals.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t('history')}</p>
                {approvals.map((approval: Approval) => (
                  <div key={approval.id} className="flex items-start justify-between text-sm border-l-2 pl-2">
                    <div>
                      <Badge className={ApprovalStatusColors[approval.status as keyof typeof ApprovalStatusColors]}>
                        {approval.status}
                      </Badge>
                      {approval.comment && (
                        <p className="text-muted-foreground mt-1 text-xs">{approval.comment}</p>
                      )}
                    </div>
                    <span className="text-muted-foreground text-xs">{formatDate(approval.createdAt)}</span>
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

      <CommentModal
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        entityType="STAGE"
        entityId={stage.id}
        projectId={project.id}
        entityName={stage.name}
      />
    </>
  );
}
