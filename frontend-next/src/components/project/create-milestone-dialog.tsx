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
import { RichTextInput } from '@/components/rich-text-input';
import { useCreateMilestone } from '@/lib/actions/project/queries';
import { Plus, Loader2, Layers } from 'lucide-react';
import { toast } from 'sonner';

interface CreateMilestoneDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateMilestoneDialog({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: CreateMilestoneDialogProps) {
  const createMilestoneMutation = useCreateMilestone(projectId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (isSubmitting) return;
    setTitle('');
    setDescription('');
    onOpenChange(false);
  };

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Informe o título da etapa');
      return;
    }

    setIsSubmitting(true);
    try {
      await createMilestoneMutation.mutateAsync({
        title: trimmedTitle,
        description: description.trim() || undefined,
      });
      toast.success('Etapa criada com sucesso!');
      handleClose();
      onSuccess?.();
    } catch {
      toast.error('Erro ao criar etapa');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Nova Etapa do Projeto
          </DialogTitle>
          <DialogDescription className="text-xs">
            Crie uma nova etapa (coluna) para organizar as tarefas e entregas do fluxo do projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Título da Etapa */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Nome da Etapa <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="Ex: Planejamento, Desenvolvimento, Testes e Validação..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !description) {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
              className="text-xs h-9"
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          {/* Descrição em Rich Text */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Descrição e Objetivos (opcional)
            </label>
            <RichTextInput
              ariaLabel="Descrição da nova etapa"
              placeholder="Descreva o escopo, metas, links de homologação ou instruções para a equipe e o cliente..."
              value={description}
              onChange={setDescription}
              className="min-h-28 text-xs"
              formatLabels={{
                bold: 'Negrito (*texto*)',
                italic: 'Itálico (_texto_)',
                strikethrough: 'Riscado (~texto~)',
                code: 'Código (```texto```)',
              }}
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleCreate}
            disabled={!title.trim() || isSubmitting}
            className="text-xs gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Criar Etapa
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

