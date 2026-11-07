'use client';

import { useState } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TaskCard } from './task-card';
import { MilestoneApprovalAction } from './milestone-approval-action';
import { MilestoneDetailSheet } from './milestone-detail-sheet';
import {
  GripVertical,
  Plus,
  MoreVertical,
  Trash2,
  Edit2,
  Check,
  MessageSquare,
  AlignLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { useUpdateMilestone } from '@/lib/actions/project/queries';
import type { Milestone, MilestoneTask } from '@/lib/actions/project/types';

interface MilestoneColumnProps {
  projectId: string;
  milestone: Milestone;
  canEdit?: boolean;
  onSelectTask: (task: MilestoneTask, milestoneTitle: string) => void;
  onAddTask?: (milestoneId: string, title: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onDeleteMilestone?: (milestoneId: string) => void;
}

export function MilestoneColumn({
  projectId,
  milestone,
  canEdit = true,
  onSelectTask,
  onAddTask,
  onDeleteTask,
  onDeleteMilestone,
}: MilestoneColumnProps) {
  const updateMilestoneMutation = useUpdateMilestone(projectId);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(milestone.title);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: milestone.id,
    disabled: !canEdit,
    data: {
      type: 'COLUMN',
      milestone,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    pointerEvents: isDragging ? ('none' as const) : undefined,
  };

  const handleSaveTitle = async () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === milestone.title) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await updateMilestoneMutation.mutateAsync({
        milestoneId: milestone.id,
        data: { title: trimmed },
      });
      setIsEditingTitle(false);
      toast.success('Etapa renomeada');
    } catch {
      toast.error('Erro ao renomear etapa');
    }
  };

  const handleAddTask = () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed || !onAddTask) return;
    onAddTask(milestone.id, trimmed);
    setNewTaskTitle('');
  };

  const tasks = milestone.tasks ?? [];
  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-[300px] flex-shrink-0 flex flex-col max-h-full"
    >
      <Card className="flex flex-col max-h-[calc(100vh-220px)] bg-muted/30 border shadow-xs rounded-xl overflow-hidden">
        {/* Cabeçalho da Milestone */}
        <CardHeader className="p-3 pb-2 border-b bg-muted/20 space-y-2">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {canEdit && (
                <div
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/60 hover:text-foreground"
                  title="Arrastar etapa"
                >
                  <GripVertical className="h-4 w-4" />
                </div>
              )}

              {isEditingTitle ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSaveTitle();
                      if (e.key === 'Escape') {
                        setTitle(milestone.title);
                        setIsEditingTitle(false);
                      }
                    }}
                    className="h-7 text-xs font-semibold px-2"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={handleSaveTitle}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <span
                  className={`text-xs font-semibold tracking-tight text-foreground truncate ${
                    canEdit ? 'cursor-pointer hover:underline' : ''
                  }`}
                  onClick={() => canEdit && setIsEditingTitle(true)}
                  title={milestone.title}
                >
                  {milestone.title}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                {tasks.length}
              </Badge>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsDetailOpen(true)}>
                    <AlignLeft className="mr-2 h-3.5 w-3.5" />
                    {canEdit ? 'Detalhes e descrição' : 'Ver detalhes'}
                  </DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuItem onClick={() => setIsEditingTitle(true)}>
                      <Edit2 className="mr-2 h-3.5 w-3.5" />
                      Renomear etapa
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setIsDetailOpen(true)}>
                    <MessageSquare className="mr-2 h-3.5 w-3.5" />
                    Comentários da etapa
                  </DropdownMenuItem>
                  {canEdit && onDeleteMilestone && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDeleteMilestone(milestone.id)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Excluir etapa
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Descrição resumida da etapa (se houver) */}
          {milestone.description && (
            <button
              type="button"
              onClick={() => setIsDetailOpen(true)}
              className="text-left text-[11px] text-muted-foreground line-clamp-1 hover:text-foreground transition-colors cursor-pointer"
              title="Clique para ver a descrição detalhada"
            >
              {milestone.description}
            </button>
          )}

          {/* Validação / Aprovação da Milestone */}
          <div className="flex items-center justify-between pt-0.5">
            <MilestoneApprovalAction
              projectId={projectId}
              milestoneId={milestone.id}
              milestoneTitle={milestone.title}
              canEdit={canEdit}
            />
          </div>
        </CardHeader>

        {/* Lista de Tarefas (Sortable) */}
        <CardContent className="p-2.5 flex-1 overflow-y-auto space-y-2 min-h-24">
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                canEdit={canEdit}
                onSelect={(t) => onSelectTask(t, milestone.title)}
                onDelete={onDeleteTask}
              />
            ))}
          </SortableContext>

          {tasks.length === 0 && (
            <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground/70">
              Nenhuma tarefa nesta etapa.
            </div>
          )}
        </CardContent>

        {/* Adicionar nova tarefa rápido */}
        {canEdit && onAddTask && (
          <div className="p-2 border-t bg-card/60">
            <div className="flex gap-1.5">
              <Input
                placeholder="Adicionar tarefa..."
                className="h-8 text-xs bg-background"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 flex-shrink-0"
                onClick={handleAddTask}
                disabled={!newTaskTitle.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Drawer de Detalhes, Descrição Rica e Comentários da Milestone */}
      <MilestoneDetailSheet
        projectId={projectId}
        milestone={milestone}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        canEdit={canEdit}
      />
    </div>
  );
}

