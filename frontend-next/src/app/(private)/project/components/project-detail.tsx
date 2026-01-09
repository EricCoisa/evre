'use client';

import { useTranslation } from 'react-i18next';
import { Project, ApprovalStatusColors, Stage, Approval, ProjectHistory } from '@/lib/actions/project/types';
import { useStages, useActivities, useCommentsByProject, useApprovalsByStage, useHistoryByProject, useUpdateProject, useStatus } from '@/lib/actions/project/queries';
import { useCreateComment, useCreateApproval, useCreateStage, useCreateActivity } from '@/lib/actions/project/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatDate } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import type { FieldConfig } from '@/lib/form/field-config';
import { GenericCreateFormModal } from '@/components/generic-create-form';
import LangLabel from '@/components/ui/langLabel';
import { SortableActivitiesList } from './sortable-activities-list';
import { DataTable } from '@/components/data-table';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { getHistoryColumns } from './history-columns';

interface ProjectDetailProps {
  project: Project;
  isAdmin?: boolean;
}

export function ProjectDetail({ project, isAdmin = false }: ProjectDetailProps) {
  const { t } = useTranslation('projects');
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [historyPagination, setHistoryPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const { data: stagesData } = useStages({ filter: { projectId: project.id }, pagination: false });
  const { data: commentsData } = useCommentsByProject(project.id);
  const { data: historyData } = useHistoryByProject(project.id, {
    page: historyPagination.pageIndex + 1,
    limit: historyPagination.pageSize,
    pagination: true,
  });

  const historyColumns: ColumnDef<ProjectHistory>[] = useMemo(() => getHistoryColumns(t), [t]);

  const { data: statusList } = useStatus();
  const availableStatuses = useMemo(() => statusList || [], [statusList]);

  const createComment = useCreateComment();
  const createStage = useCreateStage();
  const createApproval = useCreateApproval();
  const updateProject = useUpdateProject();

  const stages = useMemo(() => 
    Array.isArray(stagesData) ? stagesData : stagesData?.data || [],
  [stagesData]);
  const comments = commentsData || [];

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

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error(t('commentRequired'));
      return;
    }

    try {
      await createComment.mutateAsync({
        projectId: project.id,
        entityType: 'PROJECT',
        entityId: project.id,
        content: newComment,
      });

      toast.success(t('commentAdded'));
      setNewComment('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await updateProject.mutateAsync({
        id: project.id,
        data: { status: status },
      });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      toast.success(t('statusUpdated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error updating status');
    }
  };

  return (
    <Tabs defaultValue="details" className="space-y-6">
      <TabsList>
        <TabsTrigger value="details">
          <LangLabel text="detailsAndComments" langJson="projects" />
        </TabsTrigger>
        <TabsTrigger value="stages">
          <LangLabel text="stagesAndApprovals" langJson="projects" />
        </TabsTrigger>
        <TabsTrigger value="history">
          <LangLabel text="history" langJson="projects" />
        </TabsTrigger>
      </TabsList>

      {/* Tab 1: Detalhes & Comentários */}
      <TabsContent value="details" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle><LangLabel text="projectDetails" langJson="projects" /></CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('name')}</p>
              <p className="text-lg font-semibold">{project.name}</p>
            </div>
            {project.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('description')}</p>
                <p>{project.description}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('status')}</p>
              {isAdmin ? (
                <Select value={project.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue>
                      <Badge variant="outline">
                        {project.status}
                      </Badge>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        <Badge variant="outline">{status}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline">
                  {project.status}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('createdAt')}</p>
                <p>{formatDate(project.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('updatedAt')}</p>
                <p>{formatDate(project.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle><LangLabel text="comments" langJson="projects" /></CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-muted-foreground">{t('noComments')}</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="border-l-2 border-primary pl-4">
                    <p className="text-sm text-muted-foreground">
                      {formatDate(comment.createdAt)}
                    </p>
                    <p>{comment.content}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 pt-4 border-t">
              <Textarea
                placeholder={t('addComment')}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
              />
              <Button
                onClick={handleAddComment}
                disabled={createComment.isPending}
                size="sm"
              >
                {createComment.isPending ? 'Adding...' : t('addComment')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 2: Etapas & Aprovações */}
      <TabsContent value="stages" className="space-y-6">
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
                {stages.map((stage) => (
                  <StageItem key={stage.id} stage={stage} isAdmin={isAdmin} />
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
      </TabsContent>

      {/* Tab 3: Histórico */}
      <TabsContent value="history" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle><LangLabel text="history" langJson="projects" /></CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={historyColumns}
              data={historyData}
              error={null}
              queryKey={['history', project.id]}
              pagination={historyPagination}
              onPaginationChange={setHistoryPagination}
              emptyMessage={t('noHistory')}
              entityName={t('historyItem')}
              entityNamePlural={t('historyItems')}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function StageItem({ stage, isAdmin }: { stage: Stage; isAdmin: boolean }) {
  const { t } = useTranslation('projects');
  const queryClient = useQueryClient();
  const { data: activitiesData } = useActivities({ 
    filter: JSON.stringify({ stageId: stage.id }), 
    pagination: false 
  });
  const { data: approvalsData } = useApprovalsByStage(stage.id);
  const createActivity = useCreateActivity();

  const activities = Array.isArray(activitiesData) ? activitiesData : activitiesData?.data || [];
  const approvals = approvalsData || [];

  // Schema e config para criar Activity
  const createActivitySchema = useMemo(() =>
    z.object({
      title: z.string().min(1, t('activityTitleRequired')),
      description: z.string().optional(),
      status: z.enum(['TODO', 'DOING', 'DONE']).optional(),
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
      options: [
        { value: 'TODO', label: 'TODO' },
        { value: 'DOING', label: 'DOING' },
        { value: 'DONE', label: 'DONE' },
      ],
    },
  } satisfies FieldConfig<typeof createActivitySchema>), [t]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{stage.name}</CardTitle>
          <Badge variant="outline">Order: {stage.order}</Badge>
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
                    queryKey: ['activities', { 
                      filter: JSON.stringify({ stageId: stage.id }), 
                      pagination: false 
                    }] 
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
  );
}
