'use client';

import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";

import { useTranslation } from "@/hooks/use-translation";
import { useLogging } from "@/lib/actions/logging/queries";
import { useState } from 'react';
import { DataTable } from "@/components/data-table";
import { getLoggingColumns } from "./components/logging-columns";
import { buildTableQueryParams } from "@/lib/table-query-params";

export default function LoggingPage() {

  const { t } = useTranslation('logging');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const queryParams = buildTableQueryParams(pagination, globalFilter, filters);

  const { data, error } = useLogging(queryParams);
  
  const columns = getLoggingColumns(t);
  
  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={t('title')}
        description={t('description')}
      />
      <DataTable
        columns={columns}
        data={data}
        error={error}
        queryKey={['logging', queryParams]}
        pagination={pagination}
        onPaginationChange={setPagination}
        globalFilter={globalFilter}
        enableGlobalFilter={true}
        onGlobalFilterChange={setGlobalFilter}
        filters={filters}
        onFiltersChange={setFilters}
        searchPlaceholder={t('searchPlaceholder')}
        emptyMessage={t('noLogs')}
        entityName={t('entity')}
        entityNamePlural={t('entityPlural')}
      >
        <DataTable.Input
          title={t('searchText')}
          placeholder={t('searchPlaceholder')}
        />
        <DataTable.Select
          title={t('filterByAction')}
          accessorKey="action"
          placeholder={t('filterByAction')}
        />
        <DataTable.Select
          title={t('filterByModule')}
          accessorKey="module"
          placeholder={t('filterByModule')}
        />
      </DataTable>
    </Container>
  )
}