'use client';

import { Container } from '@/components/container';
import { PageHeader } from '@/components/page-header';
import { useTranslation } from '@/hooks/use-translation';
import { useLeads } from '@/lib/actions/lead/queries';
import { useState } from 'react';
import { DataTable } from '@/components/data-table';
import { getLeadColumns } from './components/lead-columns';
import { buildTableQueryParams } from '@/lib/table-query-params';

export default function LeadPage() {
  const { t } = useTranslation('lead');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const queryParams = buildTableQueryParams(pagination, globalFilter, filters);
  const { data, error } = useLeads(queryParams);
  const columns = getLeadColumns(t);

  return (
    <Container variant="dataTable" border={false}>
      <PageHeader title={t('title')} description={t('description')} />
      <DataTable
        columns={columns}
        data={data}
        error={error}
        queryKey={['leads', queryParams]}
        pagination={pagination}
        onPaginationChange={setPagination}
        globalFilter={globalFilter}
        enableGlobalFilter={true}
        onGlobalFilterChange={setGlobalFilter}
        filters={filters}
        onFiltersChange={setFilters}
        searchPlaceholder={t('searchPlaceholder')}
        emptyMessage={t('noLeads')}
        entityName={t('entity')}
        entityNamePlural={t('entityPlural')}
      >
        <DataTable.Input title={t('searchPlaceholder')} placeholder={t('searchPlaceholder')} />
        <DataTable.Select title={t('filterByStatus')} accessorKey="status" placeholder={t('filterByStatus')} />
      </DataTable>
    </Container>
  );
}
