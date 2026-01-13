'use client';

import { Container } from "@/components/container";

import { useTranslation } from "@/hooks/use-translation";
import { useLogging } from "@/lib/actions/logging/queries";
import { useState } from 'react';
import { DataTable } from "@/components/data-table";
import { getLoggingColumns } from "./components/logging-columns";
import { SystemConfiguration } from "@/components/system-configuration";
export default function LoggingPage() {

  const { t } = useTranslation('logging');
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

  const { data, error } = useLogging(queryParams);
  
  const columns = getLoggingColumns(t);
  
  return (
    <Container border={false}>
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
        searchPlaceholder={t('searchPlaceholder') ?? 'Buscar logs...'}
        loadingMessage={t('loading') ?? 'Carregando...'}
        emptyMessage={t('noLogs') ?? 'Nenhum log encontrado'}
        entityName={t('entity') ?? 'log'}
        entityNamePlural={t('entityPlural') ?? 'logs'}
      >
        {/* Área de Filtros e Configurações */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4">
          {/* Filtros à esquerda */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
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
          </div>
      
        </div>
      </DataTable>
    </Container>
  )
}