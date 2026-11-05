'use client';

import { useState } from 'react';
import { useProjectBoard, useCreateMilestone, useDeleteMilestone, useCreateTask, useDeleteTask } from '@/lib/actions/project/queries';
import { useTranslation } from '@/hooks/use-translation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueryClient } from '@tanstack/react-query';

interface Milestone {
  id: string;
  title: string;
  position: number;
  tasks: Task[];
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  position: number;
}

export function ProjectBoardTab({ projectId }: { projectId: string }) {
  const { t } = useTranslation('project');
  const { data: boardData, isLoading } = useProjectBoard(projectId);
  const createMilestoneMutation = useCreateMilestone(projectId);
  const deleteMilestoneMutation = useDeleteMilestone(projectId);
  const createTaskMutation = useCreateTask(projectId);
  const deleteTaskMutation = useDeleteTask(projectId);
  const queryClient = useQueryClient();

  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newTaskTitles, setNewTaskTitles] = useState<Record<string, string>>({});

  const milestones: Milestone[] = (boardData as any)?.data ?? [];

  const handleAddMilestone = async () => {
    if (!newMilestoneTitle.trim()) return;
    await createMilestoneMutation.mutateAsync({ title: newMilestoneTitle.trim() });
    setNewMilestoneTitle('');
  };

  const handleAddTask = async (milestoneId: string) => {
    const title = newTaskTitles[milestoneId]?.trim();
    if (!title) return;
    await createTaskMutation.mutateAsync({ milestoneId, data: { title } });
    setNewTaskTitles((prev) => ({ ...prev, [milestoneId]: '' }));
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="min-w-[280px]">
            <Skeleton className="h-[400px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 overflow-x-auto pb-4">
        {milestones.map((milestone) => (
          <Card key={milestone.id} className="min-w-[280px] max-w-[320px] flex-shrink-0 bg-muted/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">{milestone.title}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMilestoneMutation.mutate(milestone.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {milestone.tasks.map((task) => (
                <Card key={task.id} className="shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm">{task.title}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 flex-shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteTaskMutation.mutate(task.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
              <div className="flex gap-1">
                <Input
                  placeholder={t('tasks') + '...'}
                  className="h-7 text-xs"
                  value={newTaskTitles[milestone.id] ?? ''}
                  onChange={(e) => setNewTaskTitles((prev) => ({ ...prev, [milestone.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask(milestone.id)}
                />
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={() => handleAddTask(milestone.id)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="min-w-[280px] max-w-[320px] flex-shrink-0 border-dashed">
          <CardContent className="p-4">
            <div className="flex gap-1">
              <Input
                placeholder={t('milestones') + '...'}
                className="h-8 text-sm"
                value={newMilestoneTitle}
                onChange={(e) => setNewMilestoneTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddMilestone()}
              />
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0" onClick={handleAddMilestone}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
