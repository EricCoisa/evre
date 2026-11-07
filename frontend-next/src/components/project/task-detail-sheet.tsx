'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RichTextInput } from '@/components/rich-text-input';
import { RichTextViewer } from './rich-text-viewer';
import { ProjectCommentsThread } from './project-comments-thread';
import { useUpdateTask } from '@/lib/actions/project/queries';
import { Check, Edit3, AlignLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { MilestoneTask } from '@/lib/actions/project/types';

interface TaskDetailSheetProps {
  projectId: string;
  task: MilestoneTask | null;
  milestoneTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
}

export function TaskDetailSheet({
  projectId,
  task,
  milestoneTitle,
  open,
  onOpenChange,
  canEdit = true,
}: TaskDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {task && (
        <TaskDetailSheetContent
          key={task.id}
          projectId={projectId}
          task={task}
          milestoneTitle={milestoneTitle}
          canEdit={canEdit}
        />
      )}
    </Sheet>
  );
}

function TaskDetailSheetContent({
  projectId,
  task,
  milestoneTitle,
  canEdit = true,
}: {
  projectId: string;
  task: MilestoneTask;
  milestoneTitle?: string;
  canEdit?: boolean;
}) {
  const updateTaskMutation = useUpdateTask(projectId);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveTitle = async () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === task.title) {
      setIsEditingTitle(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateTaskMutation.mutateAsync({
        taskId: task.id,
        data: { title: trimmed },
      });
      setIsEditingTitle(false);
      toast.success('Título atualizado');
    } catch {
      toast.error('Erro ao salvar título');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDescription = async () => {
    setIsSaving(true);
    try {
      await updateTaskMutation.mutateAsync({
        taskId: task.id,
        data: { description: description.trim() },
      });
      setIsEditingDesc(false);
      toast.success('Descrição atualizada');
    } catch {
      toast.error('Erro ao salvar descrição');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SheetContent
      side="right"
      className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background"
    >
      {/* Cabeçalho do Sheet */}
      <SheetHeader className="p-6 pb-4 border-b space-y-3 bg-muted/10">
        <div className="flex items-center gap-2">
          {milestoneTitle && (
            <Badge variant="outline" className="text-xs font-normal">
              Etapa: {milestoneTitle}
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            Tarefa
          </Badge>
        </div>

        {/* Título com edição inline */}
        {canEdit && isEditingTitle ? (
          <div className="flex items-center gap-2 pt-1">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveTitle();
                if (e.key === 'Escape') {
                  setTitle(task.title);
                  setIsEditingTitle(false);
                }
              }}
              className="text-base font-semibold h-9"
              autoFocus
              disabled={isSaving}
            />
            <Button
              size="sm"
              className="h-9 px-3"
              onClick={handleSaveTitle}
              disabled={isSaving || !title.trim()}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            className={`group flex items-start justify-between gap-2 pt-1 ${
              canEdit ? 'cursor-pointer hover:bg-muted/40 p-1.5 -ml-1.5 rounded-md transition-colors' : ''
            }`}
            onClick={() => canEdit && setIsEditingTitle(true)}
          >
            <SheetTitle className="text-lg font-semibold tracking-tight text-foreground text-left leading-snug">
              {task.title}
            </SheetTitle>
            {canEdit && (
              <Edit3 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity mt-1" />
            )}
          </div>
        )}

        <SheetDescription className="sr-only">
          Detalhes e comentários da tarefa {task.title}
        </SheetDescription>
      </SheetHeader>

      {/* Corpo com scroll */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Seção Descrição Rica */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <AlignLeft className="h-3.5 w-3.5" />
              <span>Descrição</span>
            </div>
            {canEdit && !isEditingDesc && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setIsEditingDesc(true)}
              >
                <Edit3 className="mr-1 h-3 w-3" />
                Editar
              </Button>
            )}
          </div>

          {canEdit && isEditingDesc ? (
            <div className="space-y-2">
              <RichTextInput
                ariaLabel="Descrição da tarefa"
                placeholder="Descreva detalhes, objetivos ou checklists da tarefa..."
                value={description}
                onChange={setDescription}
                className="min-h-28 text-sm"
                formatLabels={{
                  bold: 'Negrito (*texto*)',
                  italic: 'Itálico (_texto_)',
                  strikethrough: 'Riscado (~texto~)',
                  code: 'Código (```texto```)',
                }}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setDescription(task.description ?? '');
                    setIsEditingDesc(false);
                  }}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSaveDescription}
                  disabled={isSaving}
                >
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={`p-3 rounded-lg border bg-card text-sm leading-relaxed ${
                canEdit && !task.description
                  ? 'cursor-pointer hover:bg-muted/30 transition-colors border-dashed'
                  : ''
              }`}
              onClick={() => canEdit && !task.description && setIsEditingDesc(true)}
            >
              {task.description ? (
                <RichTextViewer content={task.description} />
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  {canEdit
                    ? 'Nenhuma descrição adicionada. Clique para adicionar detalhes com texto rico...'
                    : 'Nenhuma descrição informada.'}
                </span>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Seção Comentários */}
        <div className="space-y-3">
          <ProjectCommentsThread
            projectId={projectId}
            entityType="TASK"
            entityId={task.id}
            title="Comentários da Tarefa"
          />
        </div>
      </div>
    </SheetContent>
  );
}
