'use client';

import { useMemo } from 'react';
import { z } from 'zod';
import { FormBuilderModal, type FormBuilderField } from '@/components/form/form-builder';
import { RichTextInput } from '@/components/rich-text-input';
import { useCreateMilestone } from '@/lib/actions/project/queries';

interface CreateMilestoneDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const schema = z.object({
  title: z.string().min(1, 'Informe o título da etapa'),
  description: z.string().optional(),
});

const fields: FormBuilderField[] = [
  {
    name: 'title',
    label: 'Nome da Etapa',
    placeholder: 'Ex: Planejamento, Desenvolvimento, Testes e Validação...',
  },
  {
    name: 'description',
    label: 'Descrição e Objetivos (opcional)',
    type: 'custom',
    render: (field) => (
      <RichTextInput
        ariaLabel="Descrição da nova etapa"
        placeholder="Descreva o escopo, metas, links de homologação ou instruções para a equipe e o cliente..."
        value={field.value as string ?? ''}
        onChange={field.onChange}
        className="min-h-28 text-xs"
        formatLabels={{
          bold: 'Negrito (*texto*)',
          italic: 'Itálico (_texto_)',
          strikethrough: 'Riscado (~texto~)',
          code: 'Código (```texto```)',
        }}
      />
    ),
  },
];

export function CreateMilestoneDialog({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: CreateMilestoneDialogProps) {
  const createMilestoneMutation = useCreateMilestone(projectId);

  return (
    <FormBuilderModal
      open={open}
      onOpenChange={onOpenChange}
      title="Nova Etapa do Projeto"
      description="Crie uma nova etapa (coluna) para organizar as tarefas e entregas do fluxo do projeto."
      schema={schema}
      fields={fields}
      submitLabel="Criar Etapa"
      onSubmit={async (data) => {
        await createMilestoneMutation.mutateAsync({
          title: data.title.trim(),
          description: data.description?.trim() || undefined,
        });
      }}
      onSuccess={() => {
        onSuccess?.();
        onOpenChange(false);
      }}
    />
  );
}
