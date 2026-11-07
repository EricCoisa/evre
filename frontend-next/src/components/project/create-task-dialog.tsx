'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RichTextInput } from '@/components/rich-text-input';
import { useCreateTask } from '@/lib/actions/project/queries';
import { TASK_STATUS_CONFIG } from './milestone-progress';
import { Plus, Loader2, CheckSquare, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { ProjectTaskStatus } from '@/lib/actions/project/types';

const RICH_TEXT_FORMAT_LABELS = {
  bold: 'Negrito (*texto*)',
  italic: 'Itálico (_texto_)',
  strikethrough: 'Riscado (~texto~)',
  code: 'Código (```texto```)',
};

interface CreateTaskDialogProps {
  projectId: string;
  milestoneId?: string;
  milestoneTitle?: string;
  availableMilestones?: { id: string; title: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateTaskDialog({
  projectId,
  milestoneId: initialMilestoneId,
  milestoneTitle: initialMilestoneTitle,
  availableMilestones = [],
  open,
  onOpenChange,
  onSuccess,
}: CreateTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <CreateTaskDialogContent
          projectId={projectId}
          initialMilestoneId={initialMilestoneId}
          initialMilestoneTitle={initialMilestoneTitle}
          availableMilestones={availableMilestones}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      )}
    </Dialog>
  );
}

function CreateTaskDialogContent({
  projectId,
  initialMilestoneId,
  initialMilestoneTitle,
  availableMilestones,
  onClose,
  onSuccess,
}: {
  projectId: string;
  initialMilestoneId?: string;
  initialMilestoneTitle?: string;
  availableMilestones: { id: string; title: string }[];
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const createTaskMutation = useCreateTask(projectId);

  const defaultMilestoneId =
    initialMilestoneId ?? (availableMilestones.length > 0 ? availableMilestones[0].id : '');

  const [selectedMilestoneId, setSelectedMilestoneId] = useState(defaultMilestoneId);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<ProjectTaskStatus>('WAITING');
  const [blockedReason, setBlockedReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Informe o título da tarefa');
      return;
    }

    if (!selectedMilestoneId) {
      toast.error('Selecione uma etapa para a tarefa');
      return;
    }

    if (status === 'BLOCKED' && !blockedReason.trim()) {
      toast.error('Informe o motivo do bloqueio da tarefa');
      return;
    }

    setIsSubmitting(true);
    try {
      await createTaskMutation.mutateAsync({
        milestoneId: selectedMilestoneId,
        data: {
          title: trimmedTitle,
          status,
          blockedReason: status === 'BLOCKED' ? blockedReason.trim() : undefined,
          description: description.trim() || undefined,
        },
      });
      toast.success('Tarefa criada com sucesso!');
      onClose();
      onSuccess?.();
    } catch {
      toast.error('Erro ao criar tarefa');
    } finally {
      setIsSubmitting(false);
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
    <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0">
      <DialogHeader className="p-6 pb-2">
        <DialogTitle className="text-base font-semibold flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          Nova Tarefa
        </DialogTitle>
        <DialogDescription className="text-xs">
          {initialMilestoneTitle
            ? `Adicionar tarefa na etapa: ${initialMilestoneTitle}`
            : 'Preencha as informações para adicionar uma nova tarefa ao projeto.'}
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
        {/* Seletor de Etapa (se houver mais de uma e não estiver pré-fixado) */}
        {availableMilestones.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Etapa (Milestone) <span className="text-destructive">*</span>
            </label>
            <Select
              value={selectedMilestoneId}
              onValueChange={setSelectedMilestoneId}
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione a etapa..." />
              </SelectTrigger>
              <SelectContent>
                {availableMilestones.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Título da Tarefa */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            Título da Tarefa <span className="text-destructive">*</span>
          </label>
          <Input
            placeholder="Ex: Criar tela de login com autenticação Google..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xs h-9"
            autoFocus
            disabled={isSubmitting}
          />
        </div>

        {/* Status da Tarefa */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            Status Inicial
          </label>
          <Select
            value={status}
            onValueChange={(val) => setStatus(val as ProjectTaskStatus)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
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
        </div>

        {/* Motivo do Bloqueio (visível se BLOCKED) */}
        {status === 'BLOCKED' && (
          <div className="space-y-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Motivo do Bloqueio <span className="text-destructive">*</span></span>
            </div>
            <Textarea
              placeholder="Ex: Aguardando credenciais de acesso da API do cliente..."
              value={blockedReason}
              onChange={(e) => setBlockedReason(e.target.value)}
              className="text-xs min-h-20 bg-background"
              disabled={isSubmitting}
            />
            <p className="text-[11px] text-muted-foreground">
              Explique o que está impedindo o avanço desta tarefa para visibilidade da equipe e do cliente.
            </p>
          </div>
        )}

        {/* Descrição em Rich Text */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center justify-between">
            <span>Descrição e Critérios de Aceite (opcional)</span>
            <span className="text-[10px] text-muted-foreground">Rich Text</span>
          </label>
          <div className="rounded-md border p-1 bg-background">
            <RichTextInput
              ariaLabel="Descrição da tarefa"
              value={description}
              onChange={setDescription}
              placeholder="Descreva o escopo da tarefa, passos de teste, links úteis..."
              className="min-h-28 text-xs"
              formatLabels={RICH_TEXT_FORMAT_LABELS}
            />
          </div>
        </div>
      </div>

      <DialogFooter className="p-4 border-t flex items-center justify-between sm:justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          className="text-xs gap-1.5"
          onClick={handleCreate}
          disabled={isSubmitting || !title.trim() || (status === 'BLOCKED' && !blockedReason.trim())}
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Criar Tarefa
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
