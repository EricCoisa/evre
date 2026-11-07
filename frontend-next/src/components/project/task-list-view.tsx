'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MilestoneApprovalAction } from './milestone-approval-action';
import { MilestoneDetailSheet } from './milestone-detail-sheet';
import { MilestoneProgressBar, TASK_STATUS_CONFIG } from './milestone-progress';
import { RichTextViewer } from './rich-text-viewer';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  MessageSquare,
  AlignLeft,
  AlertTriangle,
} from 'lucide-react';
import type { Milestone, MilestoneTask, ProjectTaskStatus } from '@/lib/actions/project/types';

interface TaskListViewProps {
  projectId: string;
  milestones: Milestone[];
  canEdit?: boolean;
  onSelectTask: (task: MilestoneTask, milestoneTitle: string) => void;
  onOpenCreateTask?: (milestoneId: string, milestoneTitle: string) => void;
  onAddTask?: (milestoneId: string, title: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onDeleteMilestone?: (milestoneId: string) => void;
}

export function TaskListView({
  projectId,
  milestones,
  canEdit = true,
  onSelectTask,
  onOpenCreateTask,
  onDeleteTask,
  onDeleteMilestone,
}: TaskListViewProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedMilestoneForDetail, setSelectedMilestoneForDetail] = useState<Milestone | null>(null);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
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
            <CardHeader className="p-3.5 bg-muted/30 border-b flex flex-col gap-2.5 space-y-0">
              <div className="flex flex-row items-center justify-between gap-3">
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
              </div>

              {/* Barra de Progresso da Milestone */}
              <div className="pt-0.5 max-w-md">
                <MilestoneProgressBar tasks={tasks} compact />
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

                {tasks.map((task) => {
                  const taskStatus: ProjectTaskStatus = task.status || 'WAITING';
                  const conf = TASK_STATUS_CONFIG[taskStatus] ?? TASK_STATUS_CONFIG.WAITING;
                  const Icon = conf.icon;

                  return (
                    <div
                      key={task.id}
                      className="group flex items-center justify-between p-3 hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => onSelectTask(task, milestone.title)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Status badge com ícone */}
                        <Badge
                          variant={conf.variant}
                          className={`h-5 text-[10px] px-1.5 gap-1 font-normal flex-shrink-0 ${conf.className}`}
                        >
                          <Icon className="h-3 w-3 flex-shrink-0" />
                          <span>{conf.label}</span>
                        </Badge>

                        <div className="space-y-0.5 truncate">
                          <span
                            className={`text-sm font-medium ${
                              taskStatus === 'CANCELLED'
                                ? 'line-through text-muted-foreground'
                                : 'text-foreground'
                            }`}
                          >
                            {task.title}
                          </span>

                          {taskStatus === 'BLOCKED' && task.blockedReason && (
                            <div className="flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-300">
                              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate max-w-md font-medium">
                                Bloqueio: {task.blockedReason}
                              </span>
                            </div>
                          )}

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
                  );
                })}

                {tasks.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Nenhuma tarefa nesta etapa.
                  </div>
                )}

                {canEdit && onOpenCreateTask && (
                  <div className="p-2.5 bg-card/50 flex justify-start">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8"
                      onClick={() => onOpenCreateTask(milestone.id, milestone.title)}
                    >
                      <Plus className="h-3.5 w-3.5 text-primary" />
                      <span>Nova tarefa em {milestone.title}</span>
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
        open={Boolean(selectedMilestoneForDetail)}
        onOpenChange={(open) => {
          if (!open) setSelectedMilestoneForDetail(null);
        }}
        canEdit={canEdit}
      />
    </div>
  );
}
