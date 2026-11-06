'use client';

import { useState } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { useQuery } from '@tanstack/react-query';
import { Collector } from '@/lib/api/collector';
import { getArtifacts } from '@/lib/actions/artifact/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import { UploadArtifactForm } from '@/components/upload-artifact-dialog';
import type { UploadConstraints } from '@/components/upload-artifact-dialog';
import type { Artifact } from '@/lib/actions/artifact/types';

interface ArtifactPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (artifact: Artifact) => void;
  filter?: (artifact: Artifact) => boolean;
  uploadConstraints?: UploadConstraints;
}

export function ArtifactPickerDialog({ open, onOpenChange, onSelect, filter, uploadConstraints }: ArtifactPickerDialogProps) {
  const { t } = useTranslation('artifact');

  const handleSelect = (artifact: Artifact) => {
    onOpenChange(false);
    onSelect(artifact);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('pickerTitle')}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="existing" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="existing" className="flex-1">{t('pickerExisting')}</TabsTrigger>
            <TabsTrigger value="upload" className="flex-1">{t('pickerUpload')}</TabsTrigger>
          </TabsList>
          <TabsContent value="existing" className="mt-4">
            <ExistingTab onSelect={handleSelect} filter={filter} />
          </TabsContent>
          <TabsContent value="upload" className="mt-4">
            <UploadArtifactForm onSuccess={handleSelect} constraints={uploadConstraints} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ExistingTab({ onSelect, filter }: { onSelect: (artifact: Artifact) => void; filter?: (artifact: Artifact) => boolean }) {
  const { t } = useTranslation('artifact');
  const [search, setSearch] = useState('');
  const params = {
    page: 1,
    limit: 20,
    pagination: true,
    ...(search && { search }),
  };
  const { data } = useQuery({
    queryKey: ['artifacts', params],
    queryFn: Collector(() => getArtifacts(params)),
    refetchOnMount: 'always' as const,
  });

  const items: Artifact[] = Array.isArray(data) ? data : data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="pl-9"
        />
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">{t('empty')}</p>
        ) : (
          items
            .filter((a) => !a.archivedAt && (!filter || filter(a)))
            .map((artifact) => (
              <button
                key={artifact.id}
                type="button"
                className="hover:bg-accent flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors"
                onClick={() => onSelect(artifact)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{artifact.name || artifact.fileName}</p>
                  <p className="text-muted-foreground truncate text-xs">{artifact.fileName}</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {artifact.kind === 'FOLDER' ? t('kindFolder') : t('kindFile')}
                </Badge>
              </button>
            ))
        )}
      </div>
    </div>
  );
}

