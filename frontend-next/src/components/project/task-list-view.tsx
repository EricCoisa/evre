'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MilestoneApprovalAction } from './milestone-approval-action';
import { MilestoneDetailSheet } from './milestone-detail-sheet';
import { MilestoneProgressBar, TASK_STATUS_CONFIG } from './milestone-progress';
import { RichTextViewer } from './rich-text-viewer';
import { UserAvatar } from './user-avatar';
import { useUpdateTask } from '@/lib/actions/project/queries';
import { useUsers } from '@/lib/actions/user/queries';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  MessageSquare,
  AlignLeft,
  AlertTriangle,
  User,
  UserX,
  Check,
  Link2,
} from 'lucide-react';
import { copyTaskLink } from './task-link';
import type { Milestone, MilestoneTask, ProjectTaskStatus } from '@/lib/actions/project/types';
import type { UserDto } from '@/lib/generated/schemas';

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
  const updateTaskMutation = useUpdateTask(projectId);
  const { data: usersData } = useUsers(undefined, { enabled: canEdit });

  const users = useMemo(() => {
    if (!usersData) return [];
    const raw = Array.isArray(usersData)
      ? (usersData as UserDto[])
      : (usersData as { data?: UserDto[] })?.data ??
        (usersData as { items?: UserDto[] })?.items ??
        [];
    return raw;
  }, [usersData]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedMilestoneForDetail, setSelectedMilestoneForDetail] = useState<Milestone | null>(null);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleQuickStatusChange = async (task: MilestoneTask, newStatus: ProjectTaskStatus) => {
    if (newStatus === task.status) return;
    if (newStatus === 'BLOCKED') {
      onSelectTask(task, '');
      return;
    }

    try {
      await updateTaskMutation.mutateAsync({
        taskId: task.id,
        data: { status: newStatus },
      });
      toast.success(`Status alterado para ${TASK_STATUS_CONFIG[newStatus].label}`);
    } catch {
      toast.error('Erro ao alterar status');
    }
  };

  const handleQuickAssigneeChange = async (task: MilestoneTask, newAssigneeId: string | null) => {
    const currentAssigneeId = task.assigneeId ?? task.assignee?.id ?? null;
    if (newAssigneeId === currentAssigneeId) return;

    try {
      await updateTaskMutation.mutateAsync({
        taskId: task.id,
        data: { assigneeId: newAssigneeId },
      });
      const targetUser = users.find((u) => u.id === newAssigneeId);
      toast.success(
        newAssigneeId && targetUser
          ? `Responsável: ${targetUser.name || targetUser.email}`
          : 'Responsável removido da tarefa'
      );
    } catch {
      toast.error('Erro ao alterar responsável');
    }
  };

  const statusList: ProjectTaskStatus[] = [
    'WAITING',
    'IN_PROGRESS',
    'BLOCKED',
    'DONE',
    'CANCELLED',
  ];

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
        const allMilestoneTasks = milestone.allTasks ?? tasks;

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

                  <Badge
                    variant="secondary"
                    className="h-5 text-[10px] px-1.5 ml-1"
                    title={
                      milestone.allTasks && milestone.allTasks.length !== tasks.length
                        ? `${tasks.length} exibidas de ${milestone.allTasks.length} tarefas nesta etapa`
                        : `${tasks.length} tarefas`
                    }
                  >
                    {milestone.allTasks && milestone.allTasks.length !== tasks.length
                      ? `${tasks.length}/${milestone.allTasks.length} tarefas`
                      : `${tasks.length} ${tasks.length === 1 ? 'tarefa' : 'tarefas'}`}
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
                <MilestoneProgressBar tasks={allMilestoneTasks} compact />
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
                        {/* Status badge com ícone e Dropdown */}
                        <div onClick={(e) => e.stopPropagation()}>
                          {canEdit ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${conf.className}`}
                                  title="Clique para alterar status rápido"
                                >
                                  <Icon className="h-3 w-3 flex-shrink-0" />
                                  <span>{conf.label}</span>
                                  <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-40 text-xs">
                                {statusList.map((st) => {
                                  const itemConf = TASK_STATUS_CONFIG[st];
                                  const ItemIcon = itemConf.icon;
                                  return (
                                    <DropdownMenuItem
                                      key={st}
                                      className="flex items-center gap-2 cursor-pointer text-xs"
                                      onClick={() => handleQuickStatusChange(task, st)}
                                    >
                                      <ItemIcon className="h-3.5 w-3.5" />
                                      <span>{itemConf.label}</span>
                                    </DropdownMenuItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <Badge
                              variant={conf.variant}
                              className={`h-5 text-[10px] px-1.5 gap-1 font-normal flex-shrink-0 ${conf.className}`}
                            >
                              <Icon className="h-3 w-3 flex-shrink-0" />
                              <span>{conf.label}</span>
                            </Badge>
                          )}
                        </div>

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
                        {/* Responsável pela Tarefa com troca rápida via Dropdown */}
                        <div onClick={(e) => e.stopPropagation()}>
                          {canEdit ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/40 hover:bg-muted border text-xs font-medium text-foreground transition-colors cursor-pointer group/assignee max-w-[150px]"
                                  title="Clique para alterar o responsável"
                                >
                                  {task.assignee ? (
                                    <>
                                      <UserAvatar
                                        name={task.assignee.name}
                                        email={task.assignee.email}
                                        imageUrl={task.assignee.imageUrl}
                                        className="h-4 w-4 text-[8px] flex-shrink-0"
                                      />
                                      <span className="text-[11px] font-medium text-foreground truncate max-w-[100px]">
                                        {task.assignee.name || task.assignee.email}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <User className="h-3 w-3 flex-shrink-0 text-muted-foreground/60" />
                                      <span className="text-[10px] text-muted-foreground/70 italic">Sem resp.</span>
                                    </>
                                  )}
                                  <ChevronDown className="h-2.5 w-2.5 opacity-50 group-hover/assignee:opacity-100 flex-shrink-0" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56 max-h-64 overflow-y-auto text-xs">
                                <DropdownMenuLabel className="text-[10px] text-muted-foreground font-semibold px-2 py-1">
                                  Atribuir Responsável
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                  className="flex items-center gap-2 cursor-pointer text-xs"
                                  onClick={() => handleQuickAssigneeChange(task, null)}
                                >
                                  <UserX className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground">Sem responsável</span>
                                  {!(task.assigneeId ?? task.assignee?.id) && (
                                    <Check className="h-3.5 w-3.5 text-primary ml-auto flex-shrink-0" />
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {users.map((u) => {
                                  const isCurrent = (task.assigneeId ?? task.assignee?.id) === u.id;
                                  return (
                                    <DropdownMenuItem
                                      key={u.id}
                                      className="flex items-center gap-2 cursor-pointer text-xs"
                                      onClick={() => handleQuickAssigneeChange(task, u.id)}
                                    >
                                      <UserAvatar
                                        name={u.name}
                                        email={u.email}
                                        imageUrl={u.imageUrl}
                                        className="h-5 w-5 text-[9px] flex-shrink-0"
                                      />
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="truncate font-medium leading-tight">
                                          {u.name || u.email}
                                        </span>
                                        {u.name && u.email && (
                                          <span className="text-[10px] text-muted-foreground truncate leading-tight">
                                            {u.email}
                                          </span>
                                        )}
                                      </div>
                                      {isCurrent && (
                                        <Check className="h-3.5 w-3.5 text-primary ml-auto flex-shrink-0" />
                                      )}
                                    </DropdownMenuItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : task.assignee ? (
                            <div
                              className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/40 border text-xs"
                              title={`Responsável: ${task.assignee.name || task.assignee.email}`}
                            >
                              <UserAvatar
                                name={task.assignee.name}
                                email={task.assignee.email}
                                imageUrl={task.assignee.imageUrl}
                                className="h-4 w-4 text-[8px]"
                              />
                              <span className="text-[11px] font-medium text-foreground truncate max-w-[120px]">
                                {task.assignee.name || task.assignee.email}
                              </span>
                            </div>
                          ) : (
                            <div
                              className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground/60 italic px-1.5 py-0.5"
                              title="Sem responsável"
                            >
                              <User className="h-3 w-3" />
                              <span>Sem resp.</span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          className="p-1 rounded-sm text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            void copyTaskLink(projectId, task.id);
                          }}
                          title="Copiar link da tarefa"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </button>

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
