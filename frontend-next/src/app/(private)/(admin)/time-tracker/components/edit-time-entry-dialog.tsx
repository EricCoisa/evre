'use client';

import { useMemo } from 'react';
import Modal from '@/components/modal';
import { FormBuilder, type FormBuilderField } from '@/components/form/form-builder';
import { useUpdateTimeEntry } from '@/lib/actions/time-tracking/queries';
import type { TimeEntry } from '@/lib/actions/time-tracking/types';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import { useScreenItem } from '@/components/agent/screen-registry';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface EditTimeEntryDialogProps {
  entry: TimeEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface TimeEntryEditProps {
  entry: TimeEntry | null;
  onCancel?: () => void;
  onSuccess?: () => void;
}

function toLocalDatetimeString(isoString?: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function TimeEntryEdit({ entry, onCancel, onSuccess }: TimeEntryEditProps) {
  const { t } = useTranslation('time-tracking');
  const queryClient = useQueryClient();
  const updateMutation = useUpdateTimeEntry();

  // Registra o item ativo na tela para o contexto do agente IA
  useScreenItem('record', 'time-entries', entry?.id);

  const updateTimeEntrySchema = useMemo(
    () =>
      z
        .object({
          description: z.string().optional(),
          startTime: z.string().min(1, t('startTimeRequired')),
          endTime: z.string().optional(),
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
        placeholder: t('activityPlaceholder'),
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
              <Label htmlFor="edit-billable" className="cursor-pointer font-medium text-sm">
                {t('billableActivity')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('billableDescription')}
              </p>
            </div>
            <Switch
              id="edit-billable"
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
              disabled={isSubmitting}
            />
          </div>
        ),
      },
      {
        name: '_auditNotice',
        label: '',
        type: 'custom',
        className: 'sm:col-span-2',
        render: () => (
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/60 text-muted-foreground text-xs">
            <ShieldAlert className="h-4 w-4 text-warning-600 flex-shrink-0 mt-0.5" />
            <span>{t('auditNotice')}</span>
          </div>
        ),
      },
    ],
    [t],
  );

  if (!entry) return null;

  return (
    <FormBuilder
      key={entry.id}
      schema={updateTimeEntrySchema}
      fields={fields}
      mode="edit"
      gridClassName="grid gap-4 sm:grid-cols-2"
      showToast={false}
      values={{
        description: entry.description ?? entry.entityTitle ?? '',
        startTime: toLocalDatetimeString(entry.startTime),
        endTime: toLocalDatetimeString(entry.endTime),
        isBillable: entry.isBillable ?? true,
      }}
      onCancel={onCancel}
      onSubmit={async (data) => {
        const payload = {
          description: data.description?.trim() || undefined,
          startTime: data.startTime ? new Date(data.startTime).toISOString() : undefined,
          endTime: data.endTime ? new Date(data.endTime).toISOString() : null,
          isBillable: data.isBillable,
        };
        return await updateMutation.mutateAsync({ id: entry.id, data: payload });
      }}
      onSuccess={() => {
        queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
        onSuccess?.();
      }}
      submitLabel={t('save')}
      cancelLabel={t('cancel')}
    />
  );
}

export function EditTimeEntryDialog({
  entry,
  open,
  onOpenChange,
}: EditTimeEntryDialogProps) {
  const { t } = useTranslation('time-tracking');

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={t('editTitle')}
      description={t('editDescription')}
    >
      <TimeEntryEdit
        entry={entry}
        onCancel={() => onOpenChange(false)}
        onSuccess={() => onOpenChange(false)}
      />
    </Modal>
  );
}
