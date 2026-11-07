'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MilestoneApprovalAction } from './milestone-approval-action';
import { MilestoneDetailSheet } from './milestone-detail-sheet';
import { RichTextViewer } from './rich-text-viewer';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  MessageSquare,
  AlignLeft,
  Circle,
} from 'lucide-react';
import type { Milestone, MilestoneTask } from '@/lib/actions/project/types';

interface TaskListViewProps {
  projectId: string;
  milestones: Milestone[];
  canEdit?: boolean;
  onSelectTask: (task: MilestoneTask, milestoneTitle: string) => void;
  onAddTask?: (milestoneId: string, title: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onDeleteMilestone?: (milestoneId: string) => void;
}

export function TaskListView({
  projectId,
  milestones,
  canEdit = true,
  onSelectTask,
  onAddTask,
  onDeleteTask,
  onDeleteMilestone,
}: TaskListViewProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [newTasks, setNewTasks] = useState<Record<string, string>>({});
  const [selectedMilestoneForDetail, setSelectedMilestoneForDetail] = useState<Milestone | null>(null);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddTask = (milestoneId: string) => {
    const title = newTasks[milestoneId]?.trim();
    if (!title || !onAddTask) return;
    onAddTask(milestoneId, title);
    setNewTasks((prev) => ({ ...prev, [milestoneId]: '' }));
  };

  if (milestones.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhuma etapa cadastrada ainda.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {milestones.map((milestone, idx) => {
        const isCollapsed = collapsed[milestone.id] ?? false;
        const tasks = milestone.tasks ?? [];

        return (
          <Card key={milestone.id} className="overflow-hidden border shadow-xs">
            <CardHeader className="p-3.5 bg-muted/30 border-b flex flex-row items-center justify-between gap-3 space-y-0">
              <div
                className="flex items-center gap-2.5 cursor-pointer select-none flex-1 min-w-0"
                onClick={() => toggleCollapse(milestone.id)}
              >
                <div className="text-muted-foreground">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>

                <div className="flex items-center gap-2 truncate">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Etapa {idx + 1}:
                  </span>
                  <span className="text-sm font-semibold text-foreground truncate">
                    {milestone.title}
                  </span>
                </div>

                <Badge variant="secondary" className="h-5 text-[10px] px-1.5 ml-1">
                  {tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}
                </Badge>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-muted-foreground hover:text-foreground px-1.5 gap-1"
                  onClick={() => setSelectedMilestoneForDetail(milestone)}
                  title="Ver detalhes e descrição da etapa"
                >
                  <AlignLeft className="h-3 w-3" />
                  Detalhes
                </Button>

                <MilestoneApprovalAction
                  projectId={projectId}
                  milestoneId={milestone.id}
                  milestoneTitle={milestone.title}
                  canEdit={canEdit}
                />

                {canEdit && onDeleteMilestone && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteMilestone(milestone.id)}
                    title="Excluir etapa"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="p-0 divide-y">
                {milestone.description && (
                  <div
                    className="px-4 py-2 bg-muted/10 border-b text-xs text-muted-foreground cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setSelectedMilestoneForDetail(milestone)}
                    title="Clique para ver ou editar detalhes da etapa"
                  >
                    <RichTextViewer content={milestone.description} className="text-xs [&_*]:text-xs line-clamp-2" />
                  </div>
                )}

                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="group flex items-center justify-between p-3 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => onSelectTask(task, milestone.title)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="space-y-0.5 truncate">
                        <span className="text-sm font-medium text-foreground">
                          {task.title}
                        </span>
                        {task.description && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <AlignLeft className="h-3 w-3" />
                            <span className="truncate max-w-md">Detalhes registrados</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span className="text-xs">Ver</span>
                      </div>

                      {canEdit && onDeleteTask && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTask(task.id);
                          }}
                          title="Excluir tarefa"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {tasks.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Nenhuma tarefa nesta etapa.
                  </div>
                )}

                {canEdit && onAddTask && (
                  <div className="p-3 bg-card/50 flex gap-2">
                    <Input
                      placeholder={`Nova tarefa para ${milestone.title}...`}
                      className="h-8 text-xs"
                      value={newTasks[milestone.id] ?? ''}
                      onChange={(e) =>
                        setNewTasks((prev) => ({ ...prev, [milestone.id]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTask(milestone.id)}
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs px-3"
                      onClick={() => handleAddTask(milestone.id)}
                      disabled={!newTasks[milestone.id]?.trim()}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Adicionar
                    </Button>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
      {/* Drawer de Detalhes da Milestone */}
      <MilestoneDetailSheet
        projectId={projectId}
        milestone={selectedMilestoneForDetail}
        open={!!selectedMilestoneForDetail}
        onOpenChange={(open) => !open && setSelectedMilestoneForDetail(null)}
        canEdit={canEdit}
      />
    </div>
  );
}

