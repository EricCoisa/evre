'use client';

import { useTranslation } from '@/hooks/use-translation';
import { useCompanies } from '@/lib/actions/company/queries';
import { DataTable } from '@/components/data-table';
import { GenericCreateFormModal } from '@/components/generic-create-form';
import { createCompany } from '@/lib/actions/company/api';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Container } from '@/components/container';
import type { Company } from '@/lib/actions/company/types';
import { useState, useMemo, useCallback } from 'react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import type { FieldConfig } from '@/lib/form/field-config';
import { Alive } from '@/lib/api/collector';
import Modal from '@/components/modal';
import { CompanyEditPage } from './components/company-edit';
import { getCompanyColumns } from './components/company-columns';

export default function CompaniesPage() {
  const { t } = useTranslation('company');
  const queryClient = useQueryClient();
  
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const queryParams = {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true,
    ...(globalFilter && { search: globalFilter }),
    ...(Object.keys(filters).length > 0 && { filter: JSON.stringify(filters) }),
  };

  const { data, error } = useCompanies(queryParams);

  const createCompanySchema = useMemo(() =>
    z.object({
      name: z.string().min(1, t('nameRequired')).max(255, t('nameMaxLength')),
    }),
  [t]);

  const companyFieldConfig = useMemo(() => ({
    name: {
      label: t('name'),
      placeholder: t('namePlaceholder'),
      description: t('nameDescription'),
    },
  } satisfies FieldConfig<typeof createCompanySchema>), [t]);

  const columns = useMemo(() =>
    getCompanyColumns(t),
    [t]
  );

  return (
    <Container variant="dataTable" border={false}>
      <DataTable
        columns={columns}
        data={data}
        error={error}
        queryKey={['companies', queryParams]}
        pagination={pagination}
        onPaginationChange={setPagination}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        filters={filters}
        onFiltersChange={setFilters}
        enableGlobalFilter={true}
        searchPlaceholder={t('searchPlaceholder')}
        loadingMessage={t('loading')}
        emptyMessage={t('noCompanies')}
        entityName={t('entity')}
        entityNamePlural={t('entityPlural')}
      >
        <DataTable.Input
          title={t('searchText')}
          placeholder={t('searchPlaceholder')}
        />
        <DataTable.Select
          title={t('status')}
          accessorKey="status"
          placeholder={t('filterByStatus')}
        />
        <DataTable.Actions className="sm:justify-end sm:w-full">
          <GenericCreateFormModal
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t('newCompany')}
              </Button>
            }
            closeOnsuccess={true}
            title={t('newCompany')}
            description={t('newCompanyDescription')}
            schema={createCompanySchema}
            fieldConfig={companyFieldConfig}
            onSubmit={async (data) => {
              const result = await Alive(() => createCompany(data))();
              return result;
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['companies'] });
            }}
            onError={(error) => {
              console.error('Erro ao criar empresa:', error);
            }}
            submitLabel={t('create')}
          />
        </DataTable.Actions>
      </DataTable>
    </Container>
  );
}
