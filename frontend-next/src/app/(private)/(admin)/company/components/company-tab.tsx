'use client';

import { useTranslation } from "@/hooks/use-translation";
import { useCompanies, useCreateCompany, useArchiveCompany } from "@/lib/actions/company/queries";
import { useState, useCallback, useMemo } from 'react';
import { DataTable } from "@/components/data-table";
import { getCompanyColumns } from "./company-columns";
import Modal from "@/components/modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormBuilderModal, type FormBuilderField } from "@/components/form/form-builder";
import { CompanyEdit } from "./company-edit";
import type { Company } from "@/lib/actions/company/types";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Alive } from "@/lib/api/collector";
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function CompanyTab() {
  const { t } = useTranslation('company');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [archivingCompany, setArchivingCompany] = useState<Company | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleEdit = useCallback((item: Company) => {
    setEditingCompany(item);
    setIsEditDialogOpen(true);
  }, []);

  const handleArchive = useCallback((item: Company) => {
    setArchivingCompany(item);
  }, []);

  const queryParams = {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
    ...(globalFilter && { search: globalFilter }),
    ...(Object.keys(filters).length > 0 && { filter: JSON.stringify(filters) }),
  };

  const { data, error } = useCompanies(queryParams);

  const createCompanyMutation = useCreateCompany();
  const archiveCompanyMutation = useArchiveCompany();

  const createCompanySchema = useMemo(() =>
    z.object({
      name: z.string().min(1, t('nameRequired')),
      tradeName: z.string().optional(),
      taxId: z.string().optional(),
      site: z.string().optional(),
      segment: z.string().optional(),
      notes: z.string().optional(),
    }),
  [t]);

  const createCompanyFields = useMemo<FormBuilderField[]>(() => [
    { name: 'name', label: t('name'), placeholder: t('namePlaceholder') },
    { name: 'tradeName', label: t('tradeName'), placeholder: t('tradeNamePlaceholder') },
    { name: 'taxId', label: t('taxId'), placeholder: t('taxIdPlaceholder') },
    { name: 'site', label: t('site'), placeholder: t('sitePlaceholder') },
    { name: 'segment', label: t('segment'), placeholder: t('segmentPlaceholder') },
    { name: 'notes', label: t('notes'), type: 'textarea', placeholder: t('notesPlaceholder') },
  ], [t]);

  const columns = useMemo(() =>
    getCompanyColumns({ t, onEdit: handleEdit, onArchive: handleArchive }),
    [t, handleEdit, handleArchive]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        error={error}
        queryKey={['companies', queryParams]}
        pagination={pagination}
        onPaginationChange={setPagination}
        globalFilter={globalFilter}
        enableGlobalFilter={true}
        onGlobalFilterChange={setGlobalFilter}
        filters={filters}
        onFiltersChange={setFilters}
        searchPlaceholder={t('searchPlaceholder')}
        emptyMessage={t('empty')}
        entityName={t('entity')}
        entityNamePlural={t('entityPlural')}
      >
        <DataTable.Input
          title={t('searchText')}
          placeholder={t('searchPlaceholder')}
        />
        <DataTable.Select
          title={t('filterByStatus')}
          accessorKey="archivedAt"
          placeholder={t('filterByStatus')}
          options={[
            { value: 'false', label: t('active') },
            { value: 'true', label: t('archived') },
          ]}
        />
        <DataTable.Actions className="sm:justify-end sm:w-full">
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus /> {t('newCompany')}
          </Button>
        </DataTable.Actions>
      </DataTable>

      <FormBuilderModal
        size="md"
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        title={t('createNewCompany')}
        description={t('createCompanyDescription')}
        schema={createCompanySchema}
        fields={createCompanyFields}
        mode="create"
        onSubmit={async (data) => {
          const result = await Alive(() => createCompanyMutation.mutateAsync(data))();
          return result;
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['companies'] });
        }}
        submitLabel={t('create')}
      />

      <Modal
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setEditingCompany(null);
        }}
        title={editingCompany ? `${t('edit')} ${editingCompany.name}` : t('edit')}
        description={t('editDescription')}
      >
        <CompanyEdit
          company={editingCompany}
          onCancel={() => {
            setIsEditDialogOpen(false);
            setEditingCompany(null);
          }}
          onSuccess={() => {
            setIsEditDialogOpen(false);
            setEditingCompany(null);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!archivingCompany}
        onOpenChange={(open) => !open && setArchivingCompany(null)}
        title={t('archiveConfirm')}
        description={archivingCompany ? `${t('archiveConfirmDescription')} "${archivingCompany.name}"?` : ''}
        confirmLabel={t('archive')}
        confirmVariant="destructive"
        onConfirm={async () => {
          if (!archivingCompany) return;
          await Alive(() => archiveCompanyMutation.mutateAsync(archivingCompany.id))();
          setArchivingCompany(null);
        }}
      />
    </>
  )
}
