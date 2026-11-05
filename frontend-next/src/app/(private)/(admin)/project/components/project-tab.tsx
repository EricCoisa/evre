'use client';

import { useTranslation } from "@/hooks/use-translation";
import { useProjects, useCreateProject, useArchiveProject } from "@/lib/actions/project/queries";
import { useCompanys } from "@/lib/actions/company/queries";
import { useState, useCallback, useMemo } from 'react';
import { DataTable } from "@/components/data-table";
import { getProjectColumns } from "./project-columns";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormBuilderModal, type FormBuilderField } from "@/components/form/form-builder";
import type { Project } from "@/lib/actions/project/types";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Alive } from "@/lib/api/collector";
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function ProjectTab() {
  const { t } = useTranslation('project');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [archivingProject, setArchivingProject] = useState<Project | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleArchive = useCallback((item: Project) => {
    setArchivingProject(item);
  }, []);

  const queryParams = {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
    ...(globalFilter && { search: globalFilter }),
    ...(Object.keys(filters).length > 0 && { filter: JSON.stringify(filters) }),
  };

  const { data, error } = useProjects(queryParams);
  const { data: companiesData } = useCompanys({ limit: 200, pagination: false });

  const createProjectMutation = useCreateProject();
  const archiveProjectMutation = useArchiveProject();

  const companyOptions = useMemo(() => {
    if (!companiesData) return [];
    const list = Array.isArray(companiesData) ? companiesData : (companiesData as any)?.data ?? [];
    return list
      .filter((c: any) => !c.archivedAt)
      .map((c: any) => ({ value: c.id, label: c.name }));
  }, [companiesData]);

  const createSchema = useMemo(() =>
    z.object({
      companyId: z.string().uuid(),
      name: z.string().min(1),
      description: z.string().optional(),
    }),
  []);

  const createFields = useMemo<FormBuilderField[]>(() => [
    { name: 'companyId', label: t('company'), type: 'select', options: companyOptions, placeholder: t('company') },
    { name: 'name', label: t('name'), placeholder: t('namePlaceholder') },
    { name: 'description', label: 'Descrição', type: 'textarea', placeholder: '' },
  ], [t, companyOptions]);

  const columns = useMemo(() =>
    getProjectColumns({ t, onArchive: handleArchive }),
    [t, handleArchive]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        error={error}
        queryKey={['projects', queryParams]}
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
          accessorKey="status"
          placeholder={t('filterByStatus')}
          options={[
            { value: 'ACTIVE', label: t('active') },
            { value: 'COMPLETED', label: t('completed') },
            { value: 'ARCHIVED', label: t('archived') },
          ]}
        />
        <DataTable.Actions className="sm:justify-end sm:w-full">
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus /> {t('newProject')}
          </Button>
        </DataTable.Actions>
      </DataTable>

      <FormBuilderModal
        size="md"
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        title={t('createNewProject')}
        description={t('createProjectDescription')}
        schema={createSchema}
        fields={createFields}
        mode="create"
        onSubmit={async (data) => {
          const result = await Alive(() => createProjectMutation.mutateAsync(data))();
          return result;
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        }}
        submitLabel={t('create')}
      />

      <ConfirmDialog
        open={!!archivingProject}
        onOpenChange={(open) => !open && setArchivingProject(null)}
        title={t('archiveConfirm')}
        description={archivingProject ? `${t('archiveConfirmDescription')} "${archivingProject.name}"?` : ''}
        confirmLabel={t('archive')}
        confirmVariant="destructive"
        onConfirm={async () => {
          if (!archivingProject) return;
          await Alive(() => archiveProjectMutation.mutateAsync(archivingProject.id))();
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          setArchivingProject(null);
        }}
      />
    </>
  );
}
