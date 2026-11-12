'use client';

import { useMemo } from 'react';
import { z } from 'zod';
import { FormBuilder, type FormBuilderField } from '@/components/form/form-builder';
import { updateArtifact, publishArtifact } from '@/lib/actions/artifact/api';
import { Alive } from '@/lib/api/collector';
import { useTranslation } from '@/hooks/use-translation';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import type { Artifact } from '@/lib/actions/artifact/types';

interface ArtifactEditProps {
  artifact: Artifact | null;
  onCancel?: () => void;
  onSuccess?: () => void;
}

export function ArtifactEdit({ artifact, onCancel, onSuccess }: ArtifactEditProps) {
  const { t } = useTranslation('artifact');
  const queryClient = useQueryClient();

  const schema = useMemo(() =>
    z.object({
      name: z.string().min(1, t('nameRequired')),
      isPublic: z.boolean(),
    }),
  [t]);

  const fields = useMemo<FormBuilderField[]>(() => [
    { name: 'name', label: t('uploadName'), placeholder: t('uploadNamePlaceholder') },
    {
      name: 'isPublic',
      label: t('editIsPublic'),
      description: t('editIsPublicDescription'),
      type: 'custom',
      render: (field, isSubmitting) => (
        <Switch
          checked={!!field.value}
          onCheckedChange={field.onChange}
          disabled={isSubmitting || !!artifact?.public}
        />
      ),
    },
  ], [t, artifact?.public]);

  if (!artifact) return null;

  return (
    <FormBuilder
      key={artifact.id}
      schema={schema}
      fields={fields}
      mode="edit"
      values={{
        name: artifact.name ?? artifact.fileName,
        isPublic: artifact.public,
      }}
      onCancel={onCancel}
      onSubmit={async (data) => {
        const { name, isPublic } = data;
        const result = await Alive(() => updateArtifact(artifact.id, { name }))();
        if (isPublic && !artifact.public) {
          await Alive(() => publishArtifact(artifact.id, true))();
        }
        return result;
      }}
      onSuccess={() => {
        queryClient.invalidateQueries({ queryKey: ['artifacts'] });
        onSuccess?.();
      }}
      submitLabel={t('save')}
      cancelLabel={t('cancel')}
      actions={{ mode: 'submit+cancel' }}
      disableSubmitWhenClean
    />
  );
}
