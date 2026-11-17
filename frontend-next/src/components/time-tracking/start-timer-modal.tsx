'use client';

import { useMemo } from 'react';
import { z } from 'zod';
import { FormBuilderModal, type FormBuilderField } from '@/components/form/form-builder';
import { useStartTimer } from '@/lib/actions/time-tracking/queries';
import { useProjects } from '@/lib/actions/project/queries';
import { useTranslation } from '@/hooks/use-translation';

interface StartTimerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDescription?: string;
  defaultProjectId?: string;
  defaultEntityType?: string;
  defaultEntityId?: string;
  defaultEntityTitle?: string;
}

const schema = z.object({
  description: z.string().optional(),
  projectId: z.string().optional(),
});

export function StartTimerModal({
  open,
  onOpenChange,
  defaultDescription = '',
  defaultProjectId,
  defaultEntityType,
  defaultEntityId,
  defaultEntityTitle,
}: StartTimerModalProps) {
  const { t } = useTranslation('time-tracking');
  const startTimerMutation = useStartTimer();
  const { data: projectsData } = useProjects({ limit: 50 });

  const fields = useMemo<FormBuilderField[]>(() => {
    const projects = Array.isArray(projectsData)
      ? projectsData
      : (projectsData as { data?: { id: string; name: string }[] })?.data ?? [];

    return [
      {
        name: 'description',
        label: t('startTimerWhat'),
        placeholder: t('startTimerPlaceholder'),
      },
      {
        name: 'projectId',
        label: t('projectLabel'),
        type: 'select',
        placeholder: t('selectProjectPlaceholder'),
        options: [
          { value: 'none', label: t('noProjectAvulso') },
          ...projects.map((p) => ({ value: p.id, label: p.name })),
        ],
      },
    ];
  }, [t, projectsData]);

  return (
    <FormBuilderModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('startTimerTitle')}
      description={t('startTimerDescription')}
      schema={schema}
      fields={fields}
      values={{
        description: defaultDescription || defaultEntityTitle || '',
        projectId: defaultProjectId ?? 'none',
      }}
      submitLabel={t('start')}
      onSubmit={async (data) => {
        await startTimerMutation.mutateAsync({
          description: data.description?.trim() || defaultEntityTitle || undefined,
          projectId: data.projectId && data.projectId !== 'none' ? data.projectId : undefined,
          isBillable: true,
          entityType: defaultEntityType,
          entityId: defaultEntityId,
          entityTitle: defaultEntityTitle,
        });
      }}
      onSuccess={() => onOpenChange(false)}
    />
  );
}
