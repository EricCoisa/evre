'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from "@/hooks/use-translation";
import { useArtifacts, useArchiveArtifact, useDeleteArtifact } from "@/lib/actions/artifact/queries";
import { useStorageHealth } from '@/lib/actions/user/queries';
import { DataTable } from "@/components/data-table";
import { getArtifactColumns } from "./artifact-columns";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { UploadArtifactDialog } from "@/components/upload-artifact-dialog";
import type { Artifact } from "@/lib/actions/artifact/types";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

export function ArtifactTab() {
  const { t } = useTranslation('artifact');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [archivingArtifact, setArchivingArtifact] = useState<Artifact | null>(null);
  const [deletingArtifact, setDeletingArtifact] = useState<Artifact | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: health } = useStorageHealth();
  const storageDisabled = health?.operational === false;

  const handleArchive = useCallback((item: Artifact) => {
    setArchivingArtifact(item);
  }, []);

  const handleDelete = useCallback((item: Artifact) => {
    setDeletingArtifact(item);
  }, []);

  const queryParams = {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
    ...(globalFilter && { search: globalFilter }),
  };

  const { data, error, isLoading } = useArtifacts(queryParams);
  const archiveArtifactMutation = useArchiveArtifact();
  const deleteArtifactMutation = useDeleteArtifact();

  const columns = getArtifactColumns({ t, onArchive: handleArchive, onDelete: handleDelete });

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        error={error}
        isLoading={isLoading}
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
            onClick={() => setUploadOpen(true)}
            disabled={storageDisabled}
            title={storageDisabled ? t('storageDisabled') : t('upload')}
          >
            <Upload /> {t('upload')}
          </Button>
        </DataTable.Actions>
      </DataTable>

      <UploadArtifactDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['artifacts'] })}
      />

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

      <ConfirmDialog
        open={!!deletingArtifact}
        onOpenChange={(open) => !open && setDeletingArtifact(null)}
        title={t('deleteConfirm')}
        description={deletingArtifact ? `${t('deleteConfirmDescription')} "${deletingArtifact.name || deletingArtifact.fileName}"?` : ''}
        confirmLabel={t('deletePermanent')}
        confirmVariant="destructive"
        onConfirm={async () => {
          if (!deletingArtifact) return;
          await deleteArtifactMutation.mutateAsync(deletingArtifact.id);
          queryClient.invalidateQueries({ queryKey: ['artifacts'] });
          setDeletingArtifact(null);
        }}
      />
    </>
  );
}
