'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from "@/hooks/use-translation";
import { useArtifacts, useArchiveArtifact, useUploadArtifact } from "@/lib/actions/artifact/queries";
import { useStorageHealth } from '@/lib/actions/user/queries';
import { DataTable } from "@/components/data-table";
import { getArtifactColumns } from "./artifact-columns";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Artifact } from "@/lib/actions/artifact/types";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload } from 'lucide-react';

export function ArtifactTab() {
  const { t } = useTranslation('artifact');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [archivingArtifact, setArchivingArtifact] = useState<Artifact | null>(null);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: health } = useStorageHealth();
  const storageDisabled = health?.operational === false;

  const handleArchive = useCallback((item: Artifact) => {
    setArchivingArtifact(item);
  }, []);

  const queryParams = {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
    ...(globalFilter && { search: globalFilter }),
  };

  const { data, error } = useArtifacts(queryParams);

  const uploadArtifactMutation = useUploadArtifact();
  const archiveArtifactMutation = useArchiveArtifact();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    uploadArtifactMutation.mutate(file, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['artifacts'] }),
    });
  };

  const columns = getArtifactColumns({ t, onArchive: handleArchive });

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        error={error}
        queryKey={['artifacts', queryParams]}
        pagination={pagination}
        onPaginationChange={setPagination}
        globalFilter={globalFilter}
        enableGlobalFilter={true}
        onGlobalFilterChange={setGlobalFilter}
        searchPlaceholder={t('searchPlaceholder')}
        emptyMessage={t('empty')}
        entityName={t('entity')}
        entityNamePlural={t('entityPlural')}
      >
        <DataTable.Input
          title={t('searchText')}
          placeholder={t('searchPlaceholder')}
        />
        <DataTable.Actions className="sm:justify-end sm:w-full">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={storageDisabled || uploadArtifactMutation.isPending}
            title={storageDisabled ? t('storageDisabled') : t('uploadAccept')}
          >
            <Upload /> {uploadArtifactMutation.isPending ? t('uploading') : t('upload')}
          </Button>
          <Input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".html,image/png,image/jpeg,image/svg+xml,image/webp,.zip,application/zip"
            disabled={storageDisabled || uploadArtifactMutation.isPending}
            onChange={handleFile}
          />
        </DataTable.Actions>
      </DataTable>

      <ConfirmDialog
        open={!!archivingArtifact}
        onOpenChange={(open) => !open && setArchivingArtifact(null)}
        title={t('archiveConfirm')}
        description={archivingArtifact ? `${t('archiveConfirmDescription')} "${archivingArtifact.fileName}"?` : ''}
        confirmLabel={t('archive')}
        confirmVariant="destructive"
        onConfirm={async () => {
          if (!archivingArtifact) return;
          await archiveArtifactMutation.mutateAsync(archivingArtifact.id);
          queryClient.invalidateQueries({ queryKey: ['artifacts'] });
          setArchivingArtifact(null);
        }}
      />
    </>
  );
}
