'use client';

import { useState } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { useQueryClient } from '@tanstack/react-query';
import { useUploadArtifact, usePublishArtifact } from '@/lib/actions/artifact/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { SwitchField } from '@/components/switch-field';
import { Upload } from 'lucide-react';
import type { Artifact } from '@/lib/actions/artifact/types';

export interface UploadConstraints {
  maxSizeBytes?: number;
  aspectRatio?: { width: number; height: number; tolerancePct?: number };
  accept?: string;
}

interface UploadArtifactFormProps {
  onSuccess: (artifact: Artifact) => void;
  constraints?: UploadConstraints;
}

function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

export function UploadArtifactForm({ onSuccess, constraints }: UploadArtifactFormProps) {
  const { t } = useTranslation('artifact');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const upload = useUploadArtifact();
  const publish = usePublishArtifact();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;

    setValidationError(null);

    if (constraints?.maxSizeBytes && selected.size > constraints.maxSizeBytes) {
      const maxMB = (constraints.maxSizeBytes / 1_000_000).toFixed(0);
      setValidationError(t('uploadFileTooLarge', { maxMB }));
      return;
    }

    if (constraints?.aspectRatio && selected.type.startsWith('image/')) {
      const url = URL.createObjectURL(selected);
      try {
        const { width, height } = await loadImageDimensions(url);
        const actual = width / height;
        const { width: ew, height: eh, tolerancePct = 0.1 } = constraints.aspectRatio;
        const expected = ew / eh;
        if (Math.abs(actual - expected) / expected > tolerancePct) {
          setValidationError(
            t('uploadAspectRatioMismatch', {
              expected: `${ew}:${eh}`,
              actual: `${width}:${height}`,
            }),
          );
          return;
        }
      } catch {
        // imagem inválida: deixa o backend rejeitar
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    setFile(selected);
    if (!name) setName(selected.name.replace(/\.[^.]+$/, ''));
  };

  const handleSubmit = () => {
    if (!file || !name.trim()) return;
    upload.mutate(
      { file, name: name.trim() },
      {
        onSuccess: (artifact) => {
          const reset = () => {
            setName('');
            setFile(null);
            setIsPublic(false);
            queryClient.invalidateQueries({ queryKey: ['artifacts'] });
            onSuccess(artifact);
          };
          if (isPublic) {
            publish.mutate({ id: artifact.id, isPublic: true }, { onSuccess: reset });
          } else {
            reset();
          }
        },
      },
    );
  };

  const accept = constraints?.accept ?? '.html,image/png,image/jpeg,image/svg+xml,image/webp,.zip,application/zip';

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('uploadName')}</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('uploadNamePlaceholder')}
        />
      </div>
      <div className="space-y-2">
        <Label>{t('uploadFile')}</Label>
        <Input type="file" accept={accept} onChange={handleFileSelect} />
        {validationError && (
          <p className="text-destructive text-sm">{validationError}</p>
        )}
      </div>
      <SwitchField
        id="upload-is-public"
        checked={isPublic}
        onCheckedChange={setIsPublic}
        label={t('uploadIsPublic')}
        description={t('uploadIsPublicDescription')}
      />
      <DialogFooter>
        <Button
          onClick={handleSubmit}
          disabled={!file || !name.trim() || !!validationError || upload.isPending || publish.isPending}
        >
          <Upload />
          {upload.isPending ? t('uploading') : t('upload')}
        </Button>
      </DialogFooter>
    </div>
  );
}

interface UploadArtifactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (artifact: Artifact) => void;
}

export function UploadArtifactDialog({ open, onOpenChange, onSuccess }: UploadArtifactDialogProps) {
  const { t } = useTranslation('artifact');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('uploadTitle')}</DialogTitle>
        </DialogHeader>
        <UploadArtifactForm
          onSuccess={(artifact) => {
            onOpenChange(false);
            onSuccess?.(artifact);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
