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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { RichTextInput } from '@/components/rich-text-input';
import { RichTextViewer } from './rich-text-viewer';
import { ProjectCommentsThread } from './project-comments-thread';
import { TASK_STATUS_CONFIG } from './milestone-progress';
import { useUpdateTask } from '@/lib/actions/project/queries';
import { Check, Edit3, AlignLeft, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { MilestoneTask, ProjectTaskStatus } from '@/lib/actions/project/types';

const RICH_TEXT_FORMAT_LABELS = {
  bold: 'Negrito (*texto*)',
  italic: 'Itálico (_texto_)',
  strikethrough: 'Riscado (~texto~)',
  code: 'Código (```texto```)',
};

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
  const [status, setStatus] = useState<ProjectTaskStatus>(task.status || 'WAITING');
  const [blockedReason, setBlockedReason] = useState(task.blockedReason ?? '');

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [isBlockedReasonModalOpen, setIsBlockedReasonModalOpen] = useState(false);
  const [tempBlockedReason, setTempBlockedReason] = useState(task.blockedReason ?? '');
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

  const handleStatusChange = async (newStatus: ProjectTaskStatus) => {
    if (newStatus === status) return;

    if (newStatus === 'BLOCKED') {
      // Abre modal para preencher o motivo do bloqueio
      setTempBlockedReason(blockedReason);
      setIsBlockedReasonModalOpen(true);
      return;
    }

    setIsSaving(true);
    try {
      await updateTaskMutation.mutateAsync({
        taskId: task.id,
        data: {
          status: newStatus,
          blockedReason: null,
        },
      });
      setStatus(newStatus);
      setBlockedReason('');
      toast.success(`Status alterado para ${TASK_STATUS_CONFIG[newStatus].label}`);
    } catch {
      toast.error('Erro ao alterar status');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmBlockedReason = async () => {
    const trimmed = tempBlockedReason.trim();
    if (!trimmed) {
      toast.error('Informe o motivo do bloqueio');
      return;
    }

    setIsSaving(true);
    try {
      await updateTaskMutation.mutateAsync({
        taskId: task.id,
        data: {
          status: 'BLOCKED',
          blockedReason: trimmed,
        },
      });
      setStatus('BLOCKED');
      setBlockedReason(trimmed);
      setIsBlockedReasonModalOpen(false);
      toast.success('Tarefa marcada como bloqueada');
    } catch {
      toast.error('Erro ao salvar motivo do bloqueio');
    } finally {
      setIsSaving(false);
    }
  };

  const statusList: ProjectTaskStatus[] = [
    'WAITING',
    'IN_PROGRESS',
    'BLOCKED',
    'DONE',
    'CANCELLED',
  ];

  const currentStatusConfig = TASK_STATUS_CONFIG[status] ?? TASK_STATUS_CONFIG.WAITING;
  const StatusIcon = currentStatusConfig.icon;

  return (
    <>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background"
      >
        {/* Cabeçalho do Sheet */}
        <SheetHeader className="p-6 pb-4 border-b space-y-3 bg-muted/10">
          <div className="flex items-center justify-between gap-2 flex-wrap">
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

            {/* Seletor de Status */}
            {canEdit ? (
              <Select
                value={status}
                onValueChange={(val) => handleStatusChange(val as ProjectTaskStatus)}
                disabled={isSaving}
              >
                <SelectTrigger className="h-8 text-xs w-40">
                  <div className="flex items-center gap-1.5 truncate">
                    <StatusIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{currentStatusConfig.label}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {statusList.map((st) => {
                    const conf = TASK_STATUS_CONFIG[st];
                    const Icon = conf.icon;
                    return (
                      <SelectItem key={st} value={st} className="text-xs">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          <span>{conf.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <Badge
                variant={currentStatusConfig.variant}
                className={`h-6 text-xs px-2 gap-1 font-normal ${currentStatusConfig.className}`}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                <span>{currentStatusConfig.label}</span>
              </Badge>
            )}
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
          {/* Alerta de Tarefa Bloqueada */}
          {status === 'BLOCKED' && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  Tarefa Bloqueada
                </span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 px-2"
                    onClick={() => {
                      setTempBlockedReason(blockedReason);
                      setIsBlockedReasonModalOpen(true);
                    }}
                  >
                    <Edit3 className="mr-1 h-3 w-3" />
                    Alterar Motivo
                  </Button>
                )}
              </div>
              <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {blockedReason || 'Nenhum motivo detalhado foi fornecido.'}
              </p>
            </div>
          )}

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
                  value={description}
                  onChange={setDescription}
                  placeholder="Escreva detalhes adicionais, links, notas ou critérios para esta tarefa..."
                  className="min-h-28 text-xs"
                  formatLabels={RICH_TEXT_FORMAT_LABELS}
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    variant="ghost"
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
              <RichTextViewer
                content={task.description}
                fallbackText="Nenhuma descrição informada para esta tarefa."
              />
            )}
          </div>

          <Separator />

          {/* Seção Comentários */}
          <div className="space-y-2">
            <ProjectCommentsThread
              projectId={projectId}
              entityType="TASK"
              entityId={task.id}
            />
          </div>
        </div>
      </SheetContent>

      {/* Modal para Informar/Editar o Motivo do Bloqueio */}
      <Dialog open={isBlockedReasonModalOpen} onOpenChange={setIsBlockedReasonModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4" />
              Motivo do Bloqueio
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe o que está bloqueando o andamento da tarefa <strong>{task.title}</strong>:
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <Textarea
              value={tempBlockedReason}
              onChange={(e) => setTempBlockedReason(e.target.value)}
              placeholder="Ex: Aguardando definição de escopo do cliente, erro no ambiente externo de homologação..."
              className="text-xs min-h-24 resize-none"
              autoFocus
            />
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setIsBlockedReasonModalOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleConfirmBlockedReason}
              disabled={isSaving || !tempBlockedReason.trim()}
            >
              Confirmar Bloqueio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
