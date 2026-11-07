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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GripVertical, Trash2, AlignLeft, MessageSquare, AlertTriangle, ChevronDown } from 'lucide-react';
import { TASK_STATUS_CONFIG } from './milestone-progress';
import { useUpdateTask } from '@/lib/actions/project/queries';
import { toast } from 'sonner';
import type { MilestoneTask, ProjectTaskStatus } from '@/lib/actions/project/types';

interface TaskCardProps {
  projectId?: string;
  task: MilestoneTask;
  canEdit?: boolean;
  onSelect: (task: MilestoneTask) => void;
  onDelete?: (taskId: string) => void;
}

export function TaskCard({ projectId, task, canEdit = true, onSelect, onDelete }: TaskCardProps) {
  const updateTaskMutation = useUpdateTask(projectId ?? '');

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
          currentStatus === 'BLOCKED' ? 'border-rose-500/40' : ''
        } ${currentStatus === 'DONE' ? 'opacity-90' : ''}`}
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

          {/* Rodapé do Card com pistas visuais */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
            {task.description && (
              <div className="flex items-center gap-1" title="Contém descrição detalhada">
                <AlignLeft className="h-3 w-3 text-muted-foreground/70" />
                <span className="truncate max-w-[140px] text-[10px] text-muted-foreground/80">
                  Detalhes
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto">
              <MessageSquare className="h-3 w-3" />
              <span className="text-[10px]">Abrir</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
