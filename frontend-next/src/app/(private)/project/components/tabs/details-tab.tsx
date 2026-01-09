'use client';

import { Project } from '@/lib/actions/project/types';
import { useCommentsByProject, useUpdateProject, useProjectStatus } from '@/lib/actions/project/queries';
import { useCreateComment } from '@/lib/actions/project/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import LangLabel from '@/components/ui/langLabel';
import { useTranslation } from '@/hooks/use-translation';

interface DetailsTabProps {
  project: Project;
  isAdmin?: boolean;
}

export function DetailsTab({ project, isAdmin = false }: DetailsTabProps) {
  const { t } = useTranslation('projects');
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');

  const { data: commentsData } = useCommentsByProject(project.id);
  const { data: statusList } = useProjectStatus();
  const availableStatuses = useMemo(() => statusList || [], [statusList]);

  const createComment = useCreateComment();
  const updateProject = useUpdateProject();

  const comments = commentsData || [];

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
                      <Badge variant="outline">{t(status)}</Badge>
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
          {/* Token do projeto (webhook) */}
          <div>
            <p className="text-sm font-medium text-muted-foreground">SistemID</p>
            <p className="font-mono break-all text-xs bg-muted rounded p-2 select-all">{project.id || <span className="text-muted-foreground">—</span>}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Token (Webhook)</p>
            <p className="font-mono break-all text-xs bg-muted rounded p-2 select-all">{project.token || <span className="text-muted-foreground">—</span>}</p>
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
    </div>
  );
}
