'use client';

import { useMemo } from 'react';
import { z } from 'zod';
import { useFormContext } from 'react-hook-form';
import { FormBuilder, type FormBuilderField } from '@/components/form/form-builder';
import { updateArtifact, publishArtifact } from '@/lib/actions/artifact/api';
import { Alive } from '@/lib/api/collector';
import { useTranslation } from '@/hooks/use-translation';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import type { Artifact } from '@/lib/actions/artifact/types';

/** Switch "Público" precisa observar o campo "published" do mesmo form. */
function PublicSwitch({
  value,
  onChange,
  isSubmitting,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  isSubmitting: boolean;
}) {
  const { watch } = useFormContext();
  const published = watch('published') as boolean;
  return (
    <Switch
      checked={value}
      onCheckedChange={onChange}
      disabled={isSubmitting || !published}
    />
  );
}

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
      published: z.boolean(),
      isPublic: z.boolean(),
    }),
  [t]);

  const fields = useMemo<FormBuilderField[]>(() => [
    { name: 'name', label: t('uploadName'), placeholder: t('uploadNamePlaceholder') },
    {
      name: 'published',
      label: t('editPublished'),
      description: t('editPublishedDescription'),
      type: 'custom',
      render: (field, isSubmitting) => (
        <Switch
          checked={!!field.value}
          onCheckedChange={field.onChange}
          disabled={isSubmitting}
        />
      ),
    },
    {
      name: 'isPublic',
      label: t('editIsPublic'),
      description: t('editIsPublicDescription'),
      type: 'custom',
      render: (field, isSubmitting) => (
        <PublicSwitch
          value={!!field.value}
          onChange={field.onChange}
          isSubmitting={isSubmitting}
        />
      ),
    },
  ], [t]);

  if (!artifact) return null;

  return (
    <FormBuilder
      key={artifact.id}
      schema={schema}
      fields={fields}
      mode="edit"
      values={{
        name: artifact.name ?? artifact.fileName,
        published: artifact.published,
        isPublic: artifact.public,
      }}
      onCancel={onCancel}
      onSubmit={async (data) => {
        const { name, published, isPublic } = data;
        const result = await Alive(() => updateArtifact(artifact.id, { name }))();
        const publicationChanged = published !== artifact.published || isPublic !== artifact.public;
        if (publicationChanged) {
          await Alive(() => publishArtifact(artifact.id, { published, public: isPublic }))();
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
