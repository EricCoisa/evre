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
import { MilestoneApprovalAction } from './milestone-approval-action';
import { MilestoneProgressBar } from './milestone-progress';
import { useUpdateMilestone } from '@/lib/actions/project/queries';
import { Check, Edit3, AlignLeft, Layers } from 'lucide-react';
import { toast } from 'sonner';
import type { Milestone } from '@/lib/actions/project/types';

interface MilestoneDetailSheetProps {
  projectId: string;
  milestone: Milestone | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
}

export function MilestoneDetailSheet({
  projectId,
  milestone,
  open,
  onOpenChange,
  canEdit = true,
}: MilestoneDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {milestone && (
        <MilestoneDetailSheetContent
          key={milestone.id}
          projectId={projectId}
          milestone={milestone}
          canEdit={canEdit}
        />
      )}
    </Sheet>
  );
}

function MilestoneDetailSheetContent({
  projectId,
  milestone,
  canEdit = true,
}: {
  projectId: string;
  milestone: Milestone;
  canEdit?: boolean;
}) {
  const updateMilestoneMutation = useUpdateMilestone(projectId);

  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveTitle = async () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === milestone.title) {
      setIsEditingTitle(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateMilestoneMutation.mutateAsync({
        milestoneId: milestone.id,
        data: { title: trimmed },
      });
      setIsEditingTitle(false);
      toast.success('Título da etapa atualizado');
    } catch {
      toast.error('Erro ao salvar título da etapa');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDescription = async () => {
    setIsSaving(true);
    try {
      await updateMilestoneMutation.mutateAsync({
        milestoneId: milestone.id,
        data: { description: description.trim() },
      });
      setIsEditingDesc(false);
      toast.success('Descrição da etapa atualizada');
    } catch {
      toast.error('Erro ao salvar descrição da etapa');
    } finally {
      setIsSaving(false);
    }
  };

  const tasksCount = milestone.tasks?.length ?? 0;

  return (
    <SheetContent
      side="right"
      className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background"
    >
      {/* Cabeçalho do Sheet */}
      <SheetHeader className="p-6 pb-4 border-b space-y-3 bg-muted/10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs gap-1.5 px-2.5 py-1">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Etapa do Projeto
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {tasksCount} {tasksCount === 1 ? 'tarefa' : 'tarefas'}
            </Badge>
          </div>

          <div className="mr-6">
            <MilestoneApprovalAction
              projectId={projectId}
              milestoneId={milestone.id}
              milestoneTitle={milestone.title}
              canEdit={canEdit}
            />
          </div>
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
                  setTitle(milestone.title);
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
              canEdit
                ? 'cursor-pointer hover:bg-muted/40 p-1.5 -ml-1.5 rounded-md transition-colors'
                : ''
            }`}
            onClick={() => canEdit && setIsEditingTitle(true)}
          >
            <SheetTitle className="text-lg font-semibold tracking-tight text-foreground text-left leading-snug">
              {milestone.title}
            </SheetTitle>
            {canEdit && (
              <Edit3 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity mt-1" />
            )}
          </div>
        )}

        <SheetDescription className="sr-only">
          Detalhes, descrição e comentários da etapa {milestone.title}
        </SheetDescription>
      </SheetHeader>

      {/* Corpo com scroll */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Progresso Geral da Etapa */}
        <MilestoneProgressBar tasks={milestone.allTasks ?? milestone.tasks ?? []} />

        {/* Seção Descrição Rica da Etapa */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <AlignLeft className="h-3.5 w-3.5" />
              <span>Descrição da Etapa</span>
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
                ariaLabel="Descrição da etapa"
                placeholder="Descreva os objetivos, entregáveis e critérios de aceite desta etapa..."
                value={description}
                onChange={setDescription}
                className="min-h-32 text-sm"
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
                    setDescription(milestone.description ?? '');
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
                  Salvar Descrição
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={`p-3 rounded-lg border bg-card text-sm leading-relaxed ${
                canEdit && !milestone.description
                  ? 'cursor-pointer hover:bg-muted/30 transition-colors border-dashed'
                  : ''
              }`}
              onClick={() => canEdit && !milestone.description && setIsEditingDesc(true)}
            >
              {milestone.description ? (
                <RichTextViewer content={milestone.description} />
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  {canEdit
                    ? 'Nenhuma descrição adicionada para esta etapa. Clique para adicionar detalhes com texto rico...'
                    : 'Nenhuma descrição informada pela equipe.'}
                </span>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Seção Comentários da Milestone */}
        <div className="space-y-3">
          <ProjectCommentsThread
            projectId={projectId}
            entityType="MILESTONE"
            entityId={milestone.id}
            title="Comentários da Etapa"
          />
        </div>
      </div>
    </SheetContent>
  );
}
