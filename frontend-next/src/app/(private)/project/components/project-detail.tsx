'use client';

import { useTranslation } from 'react-i18next';
import { Project, ProjectStatusColors, ActivityStatusColors, ApprovalStatusColors, Stage, Activity, Approval } from '@/lib/actions/project/types';
import { useStages, useActivities, useCommentsByProject, useApprovalsByStage, useHistoryByProject } from '@/lib/actions/project/queries';
import { useCreateComment, useCreateApproval } from '@/lib/actions/project/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import LangLabel from '@/components/ui/langLabel';

interface ProjectDetailProps {
  project: Project;
  isAdmin?: boolean;
}

export function ProjectDetail({ project, isAdmin = false }: ProjectDetailProps) {
  const { t } = useTranslation('projects');
  const [newComment, setNewComment] = useState('');
  const [selectedStageForApproval, setSelectedStageForApproval] = useState<string>('');
  const [approvalStatus, setApprovalStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [approvalComment, setApprovalComment] = useState('');

  const { data: stagesData } = useStages({ filter: { projectId: project.id }, pagination: false });
  const { data: commentsData } = useCommentsByProject(project.id);
  const { data: historyData } = useHistoryByProject(project.id);

  const createComment = useCreateComment();
  const createApproval = useCreateApproval();

  const stages = Array.isArray(stagesData) ? stagesData : stagesData?.data || [];
  const comments = commentsData || [];
  const history = historyData || [];

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error(t('commentRequired'));
      return;
    }

    try {
      await createComment.mutateAsync({
        projectId: project.id,
        content: newComment,
      });

      toast.success(t('commentAdded'));

      setNewComment('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const handleAddApproval = async () => {
    if (!selectedStageForApproval) {
      toast.error('Stage is required');
      return;
    }

    try {
      await createApproval.mutateAsync({
        stageId: selectedStageForApproval,
        status: approvalStatus,
        comment: approvalComment || undefined,
      });

      toast.success(t('approvalAdded'));

      setSelectedStageForApproval('');
      setApprovalComment('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  return (
    <div className="space-y-6">
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
            <Badge className={ProjectStatusColors[project.status]}>
              {project.status}
            </Badge>
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
          <CardTitle><LangLabel text="stages" langJson="projects" /></CardTitle>
        </CardHeader>
        <CardContent>
          {stages.length === 0 ? (
            <p className="text-muted-foreground">{t('noStages')}</p>
          ) : (
            <div className="space-y-4">
              {stages.map((stage) => (
                <StageItem key={stage.id} stage={stage} />
              ))}
            </div>
          )}
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

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle><LangLabel text="addApproval" langJson="projects" /></CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedStageForApproval} onValueChange={setSelectedStageForApproval}>
              <SelectTrigger>
                <SelectValue placeholder={t('stage')} />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={approvalStatus} onValueChange={(v) => setApprovalStatus(v as 'APPROVED' | 'REJECTED')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="APPROVED">{t('approved')}</SelectItem>
                <SelectItem value="REJECTED">{t('rejected')}</SelectItem>
              </SelectContent>
            </Select>

            <Textarea
              placeholder={t('approvalComment')}
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              rows={2}
            />

            <Button
              onClick={handleAddApproval}
              disabled={createApproval.isPending}
              size="sm"
            >
              {createApproval.isPending ? 'Adding...' : t('addApproval')}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle><LangLabel text="history" langJson="projects" /></CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-muted-foreground">{t('noHistory')}</p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="text-sm border-l-2 pl-3 py-1">
                  <span className="font-medium">{item.type}</span>
                  <span className="text-muted-foreground ml-2">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StageItem({ stage }: { stage: Stage }) {
  const { t } = useTranslation('projects');
  const { data: activitiesData } = useActivities({ filter: { stageId: stage.id }, pagination: false });
  const { data: approvalsData } = useApprovalsByStage(stage.id);

  const activities = Array.isArray(activitiesData) ? activitiesData : activitiesData?.data || [];
  const approvals = approvalsData || [];

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
          <p className="text-sm font-medium mb-2"><LangLabel text="activities" langJson="projects" /></p>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noActivities')}</p>
          ) : (
            <div className="space-y-2">
              {activities.map((activity: Activity) => (
                <div key={activity.id} className="flex items-start justify-between border-l-2 pl-3">
                  <div>
                    <p className="font-medium">{activity.title}</p>
                    {activity.description && (
                      <p className="text-sm text-muted-foreground">{activity.description}</p>
                    )}
                  </div>
                  <Badge className={ActivityStatusColors[activity.status as keyof typeof ActivityStatusColors]}>
                    {activity.status}
                  </Badge>
                </div>
              ))}
            </div>
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
