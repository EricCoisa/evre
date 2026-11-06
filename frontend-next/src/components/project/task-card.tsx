'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical, Trash2, AlignLeft, MessageSquare } from 'lucide-react';
import type { MilestoneTask } from '@/lib/actions/project/types';

interface TaskCardProps {
  task: MilestoneTask;
  canEdit?: boolean;
  onSelect: (task: MilestoneTask) => void;
  onDelete?: (taskId: string) => void;
}

export function TaskCard({ task, canEdit = true, onSelect, onDelete }: TaskCardProps) {
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

  return (
    <div ref={setNodeRef} style={style} className="touch-none group">
      <Card
        className="cursor-pointer border bg-card shadow-xs hover:border-primary/40 hover:shadow-sm transition-all"
        onClick={() => onSelect(task)}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-sm font-medium text-foreground leading-snug break-words">
              {task.title}
            </span>

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

          {/* Rodapé do Card com pistas visuais */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
            {task.description && (
              <div className="flex items-center gap-1" title="Contém descrição detalhada">
                <AlignLeft className="h-3 w-3 text-muted-foreground/70" />
                <span className="truncate max-w-[160px] text-[10px] text-muted-foreground/80">
                  Detalhes
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto">
              <MessageSquare className="h-3 w-3" />
              <span className="text-[10px]">Ver</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

