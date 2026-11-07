'use client';

import { useMemo } from 'react';
import { FormBuilderModal, type FormBuilderField } from '@/components/form/form-builder';
import { useCreateManualEntry } from '@/lib/actions/time-tracking/queries';
import { useProjects } from '@/lib/actions/project/queries';
import { useTranslation } from '@/hooks/use-translation';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface ManualEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualEntryDialog({
  open,
  onOpenChange,
}: ManualEntryDialogProps) {
  const { t } = useTranslation('time-tracking');
  const queryClient = useQueryClient();
  const createMutation = useCreateManualEntry();
  const { data: projectsData } = useProjects({ limit: 50 });

  const projects = useMemo(() => {
    if (!projectsData) return [];
    if (Array.isArray(projectsData)) return projectsData;
    return (projectsData as { data?: any[] })?.data ?? [];
  }, [projectsData]);

  const manualEntrySchema = useMemo(
    () =>
      z
        .object({
          description: z.string().min(1, t('descriptionRequired')),
          projectId: z.string().optional(),
          startTime: z.string().min(1, t('startTimeRequired')),
          endTime: z.string().min(1, t('endTimeRequired')),
          isBillable: z.boolean().default(true),
        })
        .refine(
          (data) => {
            if (!data.startTime || !data.endTime) return true;
            return new Date(data.endTime) > new Date(data.startTime);
          },
          {
            message: t('endTimeAfterStartTime'),
            path: ['endTime'],
          },
        ),
    [t],
  );

  const fields = useMemo<FormBuilderField[]>(
    () => [
      {
        name: 'description',
        label: t('activityLabel'),
        placeholder: t('manualDescriptionPlaceholder'),
        className: 'sm:col-span-2',
      },
      {
        name: 'projectId',
        label: t('projectLabel'),
        type: 'select',
        placeholder: t('selectProjectPlaceholder'),
        options: [
          { value: 'none', label: t('noProjectAvulso') },
          ...projects.map((proj: any) => ({
            value: proj.id,
            label: proj.name,
          })),
        ],
        className: 'sm:col-span-2',
      },
      {
        name: 'startTime',
        label: t('startTime'),
        type: 'datetime-local',
      },
      {
        name: 'endTime',
        label: t('endTime'),
        type: 'datetime-local',
      },
      {
        name: 'isBillable',
        label: '',
        type: 'custom',
        className: 'sm:col-span-2',
        render: (field, isSubmitting) => (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="manual-billable" className="cursor-pointer font-medium text-sm">
                {t('billableActivity')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('billableDescription')}
              </p>
            </div>
            <Switch
              id="manual-billable"
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
              disabled={isSubmitting}
            />
          </div>
        ),
      },
    ],
    [t, projects],
  );

  return (
    <FormBuilderModal
      size="md"
      gridClassName="grid gap-4 sm:grid-cols-2"
      open={open}
      onOpenChange={onOpenChange}
      title={t('manualTitle')}
      description={t('manualDescription')}
      schema={manualEntrySchema}
      fields={fields}
      mode="create"
      showToast={false}
      values={{
        isBillable: true,
        projectId: 'none',
      }}
      onSubmit={async (data) => {
        const payload = {
          description: data.description.trim() || undefined,
          startTime: new Date(data.startTime).toISOString(),
          endTime: new Date(data.endTime).toISOString(),
          projectId: data.projectId && data.projectId !== 'none' ? data.projectId : undefined,
          isBillable: data.isBillable,
        };
        return await createMutation.mutateAsync(payload);
      }}
      onSuccess={() => {
        queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      }}
      submitLabel={t('manual_entry')}
      cancelLabel={t('cancel')}
    />
  );
}
