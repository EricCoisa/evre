'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
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
import { GripVertical, Trash2, AlignLeft, MessageSquare, AlertTriangle, ChevronDown, User, UserX, Check, Play, Square } from 'lucide-react';
import { useActiveTimer, useStartTimer, useStopTimer } from '@/lib/actions/time-tracking/queries';
import { useTranslation } from '@/hooks/use-translation';
import { Feature } from '@/components/feature';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TASK_STATUS_CONFIG } from './milestone-progress';
import { UserAvatar } from './user-avatar';
import { useUpdateTask } from '@/lib/actions/project/queries';
import { useUsers } from '@/lib/actions/user/queries';
import { toast } from 'sonner';
import type { MilestoneTask, ProjectTaskStatus } from '@/lib/actions/project/types';
import type { UserDto } from '@/lib/generated/schemas';

interface TaskCardProps {
  projectId?: string;
  task: MilestoneTask;
  canEdit?: boolean;
  onSelect: (task: MilestoneTask) => void;
  onDelete?: (taskId: string) => void;
}

export function TaskCard({ projectId, task, canEdit = true, onSelect, onDelete }: TaskCardProps) {
  const { t: tTime } = useTranslation('time-tracking');
  const updateTaskMutation = useUpdateTask(projectId ?? '');
  const { data: usersData } = useUsers();
  const { data: activeTimerData } = useActiveTimer();
  const startTimerMutation = useStartTimer();
  const stopTimerMutation = useStopTimer();

  const isTimerActiveForThisTask = activeTimerData?.entry?.entityId === task.id;

  const handleToggleTimer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (isTimerActiveForThisTask) {
        await stopTimerMutation.mutateAsync();
      } else {
        await startTimerMutation.mutateAsync({
          entityType: 'TASK',
          entityId: task.id,
          entityTitle: task.title,
          description: task.title,
          projectId: projectId ?? undefined,
          isBillable: true,
        });
      }
    } catch {
      // Toast gerenciado pelo Collector
    }
  };

  const users = React.useMemo(() => {
    if (!usersData) return [];
    const raw = Array.isArray(usersData)
      ? (usersData as UserDto[])
      : (usersData as { data?: UserDto[] })?.data ??
        (usersData as { items?: UserDto[] })?.items ??
        [];
    if (task.assignee && !raw.some((u) => u.id === task.assignee?.id)) {
      return [
        {
          id: task.assignee.id,
          name: task.assignee.name,
          email: task.assignee.email,
          imageUrl: task.assignee.imageUrl,
        } as UserDto,
        ...raw,
      ];
    }
    return raw;
  }, [usersData, task.assignee]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !canEdit,
    data: {
      type: 'TASK',
      task,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    pointerEvents: isDragging ? 'none' : undefined,
  };

  const currentStatus: ProjectTaskStatus = task.status || 'WAITING';
  const statusConfig = TASK_STATUS_CONFIG[currentStatus] ?? TASK_STATUS_CONFIG.WAITING;
  const StatusIcon = statusConfig.icon;

  const handleQuickStatusChange = async (newStatus: ProjectTaskStatus) => {
    if (!projectId || newStatus === currentStatus) return;
    if (newStatus === 'BLOCKED') {
      // Abre o modal de detalhe para que o usuário informe o motivo
      onSelect(task);
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

  const handleQuickAssigneeChange = async (newAssigneeId: string | null) => {
    if (!projectId) return;
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
          ? `Responsável alterado para ${targetUser.name || targetUser.email}`
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

  return (
    <div ref={setNodeRef} style={style} className="touch-none group">
      <Card
        className={`cursor-pointer border bg-card shadow-xs hover:border-primary/40 hover:shadow-sm transition-all ${
          isTimerActiveForThisTask ? 'ring-2 ring-emerald-500/80 bg-emerald-500/5 dark:bg-emerald-500/10' : ''
        } ${currentStatus === 'BLOCKED' ? 'border-rose-500/40' : ''} ${currentStatus === 'DONE' ? 'opacity-90' : ''}`}
        onClick={() => onSelect(task)}
      >
        <CardContent className="p-3 space-y-2">
          {/* Topo do Card: Badge de Status + Drag Grip / Delete */}
          <div className="flex items-center justify-between gap-1.5">
            <div onClick={(e) => e.stopPropagation()}>
              {canEdit && projectId ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${statusConfig.className}`}
                      title="Clique para alterar status rápido"
                    >
                      <StatusIcon className="h-3 w-3 flex-shrink-0" />
                      <span>{statusConfig.label}</span>
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
                          onClick={() => handleQuickStatusChange(st)}
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
                  variant={statusConfig.variant}
                  className={`h-5 text-[10px] px-1.5 py-0 gap-1 font-normal ${statusConfig.className}`}
                >
                  <StatusIcon className="h-3 w-3 flex-shrink-0" />
                  <span>{statusConfig.label}</span>
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <Feature flag="FEATURE_TIME_TRACKING">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleToggleTimer}
                      disabled={startTimerMutation.isPending || stopTimerMutation.isPending}
                      className={`p-1 rounded-sm transition-all cursor-pointer ${
                        isTimerActiveForThisTask
                          ? 'text-destructive bg-destructive/15 hover:bg-destructive/25'
                          : 'text-muted-foreground/60 hover:text-emerald-600 hover:bg-emerald-500/10'
                      }`}
                      title={
                        isTimerActiveForThisTask
                          ? tTime('stopTaskTimer')
                          : tTime('trackTimeInTask')
                      }
                    >
                      {isTimerActiveForThisTask ? (
                        <Square className="h-3.5 w-3.5 fill-current animate-pulse" />
                      ) : (
                        <Play className="h-3.5 w-3.5 fill-current" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {isTimerActiveForThisTask
                      ? tTime('stopTaskTimer')
                      : tTime('trackTimeInTask')}
                  </TooltipContent>
                </Tooltip>
              </Feature>

              {canEdit && (
                <>
                  <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/50 hover:text-foreground rounded-sm transition-colors"
                    title="Arrastar tarefa"
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </div>
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onDelete(task.id)}
                      title="Excluir tarefa"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Título da Tarefa */}
          <div className="space-y-1">
            <span
              className={`text-sm font-medium leading-snug break-words block ${
                currentStatus === 'CANCELLED'
                  ? 'line-through text-muted-foreground'
                  : currentStatus === 'DONE'
                  ? 'text-foreground/90'
                  : 'text-foreground'
              }`}
            >
              {task.title}
            </span>
          </div>

          {/* Motivo do Bloqueio em Destaque no Card */}
          {currentStatus === 'BLOCKED' && task.blockedReason && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-700 dark:text-rose-300 space-y-0.5">
              <span className="font-semibold flex items-center gap-1 text-[10px]">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                Bloqueio:
              </span>
              <p className="line-clamp-2 text-[11px] text-foreground/90 leading-tight">
                {task.blockedReason}
              </p>
            </div>
          )}

          {/* Rodapé do Card: Responsável, Detalhes e Ações */}
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
            {/* Responsável pela Tarefa com troca rápida via Dropdown */}
            <div onClick={(e) => e.stopPropagation()}>
              {canEdit && projectId ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-1.5 py-0.5 -ml-1 rounded hover:bg-muted/80 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer group/assignee max-w-[145px]"
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
                          <span className="truncate max-w-[95px] font-medium">
                            {task.assignee.name || task.assignee.email}
                          </span>
                        </>
                      ) : (
                        <>
                          <User className="h-3 w-3 flex-shrink-0 text-muted-foreground/60" />
                          <span className="italic text-muted-foreground/70">Sem resp.</span>
                        </>
                      )}
                      <ChevronDown className="h-2.5 w-2.5 opacity-50 group-hover/assignee:opacity-100 flex-shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto text-xs">
                    <DropdownMenuLabel className="text-[10px] text-muted-foreground font-semibold px-2 py-1">
                      Atribuir Responsável
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      className="flex items-center gap-2 cursor-pointer text-xs"
                      onClick={() => handleQuickAssigneeChange(null)}
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
                          onClick={() => handleQuickAssigneeChange(u.id)}
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
                  className="flex items-center gap-1.5 min-w-0"
                  title={`Responsável: ${task.assignee.name || task.assignee.email}`}
                >
                  <UserAvatar
                    name={task.assignee.name}
                    email={task.assignee.email}
                    imageUrl={task.assignee.imageUrl}
                    className="h-4 w-4 text-[8px]"
                  />
                  <span className="text-[10px] text-muted-foreground truncate max-w-[110px] font-medium">
                    {task.assignee.name || task.assignee.email}
                  </span>
                </div>
              ) : (
                <div
                  className="flex items-center gap-1 text-[10px] text-muted-foreground/60 italic"
                  title="Sem responsável atribuído"
                >
                  <User className="h-3 w-3" />
                  <span>Sem resp.</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
              {task.description && (
                <div className="flex items-center gap-0.5 text-muted-foreground/70" title="Contém descrição detalhada">
                  <AlignLeft className="h-3 w-3" />
                </div>
              )}
              <div className="flex items-center gap-1 hover:text-foreground transition-colors">
                <MessageSquare className="h-3 w-3" />
                <span className="text-[10px]">Abrir</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
