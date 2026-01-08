'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useProjects } from '@/lib/actions/project/queries';
import { useCompanies } from '@/lib/actions/company/queries';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { getProjectColumns } from './project-columns';
import { DataTable } from '@/components/data-table';
import { Container } from '@/components/container';
import Modal from '@/components/modal';
import { ProjectCreate } from './project-create';

interface ProjectListProps {
  companyId?: string;
  showCreateButton?: boolean;
  showCompanyFilter?: boolean;
}

export function ProjectList({ 
  companyId, 
  showCreateButton = true,
  showCompanyFilter = true 
}: ProjectListProps) {
  const { t } = useTranslation('projects');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>(
    companyId ? { companyId } : {}
  );
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const queryParams = {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
    ...(globalFilter && { search: globalFilter }),
    ...(Object.keys(filters).length > 0 && { filter: JSON.stringify(filters) }),
  };

  const { data, error } = useProjects(queryParams);
  const { data: companiesData } = useCompanies({ pagination: false });

  const columns = useMemo(() => getProjectColumns({ t }), [t]);

  const handleCreateSuccess = useCallback(() => {
    setIsCreateDialogOpen(false);
  }, []);

  const companies = useMemo(() => {
    if (!companiesData) return [];
    return Array.isArray(companiesData) ? companiesData : companiesData.data;
  }, [companiesData]);

  console.log('data', data);
  console.log('pagination', pagination);  
  return (
    <>
      <Container variant="dataTable" border={false}>
        <DataTable
          columns={columns}
          data={data}
          error={error}
          queryKey={['projects', queryParams]}
          pagination={pagination}
          onPaginationChange={setPagination}
          globalFilter={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
          filters={filters}
          onFiltersChange={setFilters}
          enableGlobalFilter={true}
          searchPlaceholder={t('searchPlaceholder')}
          loadingMessage={t('loading')}
          emptyMessage={t('noProjects')}
          entityName={t('entity')}
          entityNamePlural={t('entityPlural')}
        >
          <DataTable.Input
            title={t('searchText')}
            placeholder={t('searchPlaceholder')}
          />
          {showCompanyFilter && (
            <DataTable.Select
              title={t('company')}
              accessorKey="companyName"
              placeholder={t('selectCompany')}
            />
          )}
          <DataTable.Select
            title={t('status')}
            accessorKey="status"
            placeholder={t('filterByStatus')}
          />
          {showCreateButton && (
            <DataTable.Actions className="sm:justify-end sm:w-full">
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('createProject')}
              </Button>
            </DataTable.Actions>
          )}
        </DataTable>
      </Container>

      {showCreateButton && (
        <Modal
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) {
              queryClient.invalidateQueries({ queryKey: ['projects'] });
            }
          }}
          title={t('createProject')}
          description={t('createProjectDescription')}
        >
          <ProjectCreate onSuccess={handleCreateSuccess} />
        </Modal>
      )}
    </>
  );
}
