'use client';

import { useState } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { useQueryClient } from '@tanstack/react-query';
import { useUploadArtifact } from '@/lib/actions/artifact/queries';
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
import { Upload } from 'lucide-react';
import type { Artifact } from '@/lib/actions/artifact/types';

interface UploadArtifactFormProps {
  onSuccess: (artifact: Artifact) => void;
}

export function UploadArtifactForm({ onSuccess }: UploadArtifactFormProps) {
  const { t } = useTranslation('artifact');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const queryClient = useQueryClient();
  const upload = useUploadArtifact();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;
    setFile(selected);
    if (!name) setName(selected.name.replace(/\.[^.]+$/, ''));
  };

  const handleSubmit = () => {
    if (!file || !name.trim()) return;
    upload.mutate(
      { file, name: name.trim() },
      {
        onSuccess: (artifact) => {
          setName('');
          setFile(null);
          queryClient.invalidateQueries({ queryKey: ['artifacts'] });
          onSuccess(artifact);
        },
      },
    );
  };

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
        <Input
          type="file"
          accept=".html,image/png,image/jpeg,image/svg+xml,image/webp,.zip,application/zip"
          onChange={handleFileSelect}
        />
      </div>
      <DialogFooter>
        <Button
          onClick={handleSubmit}
          disabled={!file || !name.trim() || upload.isPending}
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
