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
import { GripVertical, Trash2, AlignLeft, MessageSquare, AlertTriangle, ChevronDown, User, UserX, Check, Play, Square, Link2 } from 'lucide-react';
import { copyTaskLink } from './task-link';
import { useTranslation } from '@/hooks/use-translation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TASK_STATUS_CONFIG } from './milestone-progress';
import { UserAvatar } from './user-avatar';
import { useUpdateTask, useProjectMembers } from '@/lib/actions/project/queries';
import { toast } from 'sonner';
import type { MilestoneTask, ProjectTaskStatus } from '@/lib/actions/project/types';
import type { ProjectMemberDto } from '@/lib/generated/schemas';

export interface TimerControl {
  activeEntityId?: string;
  pending?: boolean;
  onToggle: (entityType: 'TASK' | 'MILESTONE', entity: { id: string; title: string }) => void;
}

interface TaskCardProps {
  timer?: TimerControl;
  projectId?: string;
  task: MilestoneTask;
  canEdit?: boolean;
  onSelect: (task: MilestoneTask) => void;
  onDelete?: (taskId: string) => void;
}

function getTaskCardStyle(
  transform: Parameters<typeof CSS.Transform.toString>[0],
  transition: string | undefined,
  isDragging: boolean
): React.CSSProperties {
  return {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    pointerEvents: isDragging ? 'none' : undefined,
  };
}

function getTaskCardClassName(isTimerActive: boolean, status: ProjectTaskStatus): string {
  return `cursor-pointer border bg-card shadow-xs hover:border-primary/40 hover:shadow-sm transition-all ${
    isTimerActive ? 'ring-2 ring-emerald-500/80 bg-emerald-500/5 dark:bg-emerald-500/10' : ''
  } ${status === 'BLOCKED' ? 'border-rose-500/40' : ''} ${status === 'DONE' ? 'opacity-90' : ''}`;
}

function getTaskTitleClassName(status: ProjectTaskStatus): string {
  if (status === 'CANCELLED') return 'line-through text-muted-foreground';
  if (status === 'DONE') return 'text-foreground/90';
  return 'text-foreground';
}

function TaskStatusControl({
  canEdit,
  projectId,
  statusConfig,
  onChangeStatus,
}: {
  canEdit: boolean;
  projectId?: string;
  statusConfig: (typeof TASK_STATUS_CONFIG)[ProjectTaskStatus];
  onChangeStatus: (status: ProjectTaskStatus) => void;
}) {
  const StatusIcon = statusConfig.icon;

  if (!canEdit || !projectId) {
    return (
      <Badge
        variant={statusConfig.variant}
        className={`h-5 text-[10px] px-1.5 py-0 gap-1 font-normal ${statusConfig.className}`}
      >
        <StatusIcon className="h-3 w-3 flex-shrink-0" />
        <span>{statusConfig.label}</span>
      </Badge>
    );
  }

  return (
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
        {TASK_STATUS_LIST.map((st) => {
          const itemConf = TASK_STATUS_CONFIG[st];
          const ItemIcon = itemConf.icon;
          return (
            <DropdownMenuItem
              key={st}
              className="flex items-center gap-2 cursor-pointer text-xs"
              onClick={() => onChangeStatus(st)}
            >
              <ItemIcon className="h-3.5 w-3.5" />
              <span>{itemConf.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TaskTimerButton({
  timer,
  isActive,
  onToggle,
  tTime,
}: {
  timer?: TimerControl;
  isActive: boolean;
  onToggle: (e: React.MouseEvent) => void;
  tTime: (key: string) => string;
}) {
  if (!timer) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          disabled={timer.pending}
          className={`p-1 rounded-sm transition-all cursor-pointer ${
            isActive
              ? 'text-destructive bg-destructive/15 hover:bg-destructive/25'
              : 'text-muted-foreground/60 hover:text-emerald-600 hover:bg-emerald-500/10'
          }`}
          title={isActive ? tTime('stopTaskTimer') : tTime('trackTimeInTask')}
        >
          {isActive ? (
            <Square className="h-3.5 w-3.5 fill-current animate-pulse" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{isActive ? tTime('stopTaskTimer') : tTime('trackTimeInTask')}</TooltipContent>
    </Tooltip>
  );
}

function TaskCopyLinkButton({ projectId, taskId }: { projectId?: string; taskId: string }) {
  if (!projectId) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void copyTaskLink(projectId, taskId);
          }}
          className="p-1 rounded-sm text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-all cursor-pointer opacity-0 group-hover:opacity-100"
          title="Copiar link da tarefa"
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">Copiar link da tarefa</TooltipContent>
    </Tooltip>
  );
}

function TaskDragAndDeleteControls({
  canEdit,
  attributes,
  listeners,
  taskId,
  onDelete,
}: {
  canEdit: boolean;
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
  taskId: string;
  onDelete?: (taskId: string) => void;
}) {
  if (!canEdit) return null;
  return (
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
          onClick={() => onDelete(taskId)}
          title="Excluir tarefa"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </>
  );
}

function TaskBlockedReasonBanner({
  status,
  blockedReason,
}: {
  status: ProjectTaskStatus;
  blockedReason?: string | null;
}) {
  if (status !== 'BLOCKED' || !blockedReason) return null;
  return (
    <div className="rounded border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-700 dark:text-rose-300 space-y-0.5">
      <span className="font-semibold flex items-center gap-1 text-[10px]">
        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
        Bloqueio:
      </span>
      <p className="line-clamp-2 text-[11px] text-foreground/90 leading-tight">{blockedReason}</p>
    </div>
  );
}

function AssigneeTriggerContent({ assignee }: { assignee: MilestoneTask['assignee'] }) {
  if (!assignee) {
    return (
      <>
        <User className="h-3 w-3 flex-shrink-0 text-muted-foreground/60" />
        <span className="italic text-muted-foreground/70">Sem resp.</span>
      </>
    );
  }
  return (
    <>
      <UserAvatar
        name={assignee.name}
        email={assignee.email}
        imageUrl={assignee.imageUrl}
        className="h-4 w-4 text-[8px] flex-shrink-0"
      />
      <span className="truncate max-w-[95px] font-medium">{assignee.name || assignee.email}</span>
    </>
  );
}

function AssigneeMenuItem({
  user,
  isCurrent,
  onSelect,
}: {
  user: ProjectMemberDto;
  isCurrent: boolean;
  onSelect: (userId: string) => void;
}) {
  return (
    <DropdownMenuItem
      className="flex items-center gap-2 cursor-pointer text-xs"
      onClick={() => onSelect(user.id)}
    >
      <UserAvatar name={user.name} email={user.email} imageUrl={user.imageUrl} className="h-5 w-5 text-[9px] flex-shrink-0" />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="truncate font-medium leading-tight">{user.name || user.email}</span>
        {user.name && user.email && (
          <span className="text-[10px] text-muted-foreground truncate leading-tight">{user.email}</span>
        )}
      </div>
      {isCurrent && <Check className="h-3.5 w-3.5 text-primary ml-auto flex-shrink-0" />}
    </DropdownMenuItem>
  );
}

function TaskAssigneeControl({
  canEdit,
  projectId,
  task,
  users,
  onChangeAssignee,
}: {
  canEdit: boolean;
  projectId?: string;
  task: MilestoneTask;
  users: ProjectMemberDto[];
  onChangeAssignee: (userId: string | null) => void;
}) {
  const currentAssigneeId = task.assigneeId ?? task.assignee?.id ?? null;

  if (!canEdit || !projectId) {
    if (task.assignee) {
      return (
        <div className="flex items-center gap-1.5 min-w-0" title={`Responsável: ${task.assignee.name || task.assignee.email}`}>
          <UserAvatar name={task.assignee.name} email={task.assignee.email} imageUrl={task.assignee.imageUrl} className="h-4 w-4 text-[8px]" />
          <span className="text-[10px] text-muted-foreground truncate max-w-[110px] font-medium">
            {task.assignee.name || task.assignee.email}
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 italic" title="Sem responsável atribuído">
        <User className="h-3 w-3" />
        <span>Sem resp.</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-1.5 py-0.5 -ml-1 rounded hover:bg-muted/80 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer group/assignee max-w-[145px]"
          title="Clique para alterar o responsável"
        >
          <AssigneeTriggerContent assignee={task.assignee} />
          <ChevronDown className="h-2.5 w-2.5 opacity-50 group-hover/assignee:opacity-100 flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto text-xs">
        <DropdownMenuLabel className="text-[10px] text-muted-foreground font-semibold px-2 py-1">
          Atribuir Responsável
        </DropdownMenuLabel>
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer text-xs"
          onClick={() => onChangeAssignee(null)}
        >
          <UserX className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground">Sem responsável</span>
          {!currentAssigneeId && <Check className="h-3.5 w-3.5 text-primary ml-auto flex-shrink-0" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {users.map((u) => (
          <AssigneeMenuItem key={u.id} user={u} isCurrent={currentAssigneeId === u.id} onSelect={onChangeAssignee} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const TASK_STATUS_LIST: ProjectTaskStatus[] = ['WAITING', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];

export function TaskCard({ projectId, task, canEdit = true, onSelect, onDelete, timer }: TaskCardProps) {
  const { t: tTime } = useTranslation('time-tracking');
  const updateTaskMutation = useUpdateTask(projectId ?? '');
  const { data: membersData } = useProjectMembers(projectId ?? '');

  const isTimerActiveForThisTask = timer?.activeEntityId === task.id;

  const handleToggleTimer = (e: React.MouseEvent) => {
    e.stopPropagation();
    timer?.onToggle('TASK', task);
  };

  const users = React.useMemo<ProjectMemberDto[]>(() => {
    const base = membersData ?? [];
    if (task.assignee && !base.some((u) => u.id === task.assignee?.id)) {
      return [
        { id: task.assignee.id, name: task.assignee.name ?? null, email: task.assignee.email ?? '', imageUrl: task.assignee.imageUrl ?? null },
        ...base,
      ];
    }
    return base;
  }, [membersData, task.assignee]);

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

  const style = getTaskCardStyle(transform, transition, isDragging);

  const currentStatus: ProjectTaskStatus = task.status || 'WAITING';
  const statusConfig = TASK_STATUS_CONFIG[currentStatus] ?? TASK_STATUS_CONFIG.WAITING;

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

  return (
    <div ref={setNodeRef} style={style} className="touch-none group">
      <Card
        className={getTaskCardClassName(isTimerActiveForThisTask, currentStatus)}
        onClick={() => onSelect(task)}
      >
        <CardContent className="p-3 space-y-2">
          {/* Topo do Card: Badge de Status + Drag Grip / Delete */}
          <div className="flex items-center justify-between gap-1.5">
            <div onClick={(e) => e.stopPropagation()}>
              <TaskStatusControl
                canEdit={canEdit}
                projectId={projectId}
                statusConfig={statusConfig}
                onChangeStatus={handleQuickStatusChange}
              />
            </div>

            <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <TaskTimerButton
                timer={timer}
                isActive={isTimerActiveForThisTask}
                onToggle={handleToggleTimer}
                tTime={tTime}
              />

              <TaskCopyLinkButton projectId={projectId} taskId={task.id} />

              <TaskDragAndDeleteControls
                canEdit={canEdit}
                attributes={attributes}
                listeners={listeners}
                taskId={task.id}
                onDelete={onDelete}
              />
            </div>
          </div>

          {/* Título da Tarefa */}
          <div className="space-y-1">
            <span className={`text-sm font-medium leading-snug break-words block ${getTaskTitleClassName(currentStatus)}`}>
              {task.title}
            </span>
          </div>

          {/* Motivo do Bloqueio em Destaque no Card */}
          <TaskBlockedReasonBanner status={currentStatus} blockedReason={task.blockedReason} />

          {/* Rodapé do Card: Responsável, Detalhes e Ações */}
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
            {/* Responsável pela Tarefa com troca rápida via Dropdown */}
            <div onClick={(e) => e.stopPropagation()}>
              <TaskAssigneeControl
                canEdit={canEdit}
                projectId={projectId}
                task={task}
                users={users}
                onChangeAssignee={handleQuickAssigneeChange}
              />
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
