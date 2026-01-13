'use client';

import { Container } from "@/components/container";

import { useTranslation } from "@/hooks/use-translation";
import { useState } from 'react';
import { DataTable } from "@/components/data-table";
import { getContactColumns } from "./components/contact-columns";
import { useContacts } from "@/lib/actions/contact/queries";
export default function ContactPage() {

  const { t } = useTranslation('contact');
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

  const { data, error } = useContacts(queryParams);
  
  const columns = getContactColumns(t);
  
  return (
    <Container border={false}>
      <DataTable
        columns={columns}
        data={data}
        error={error}
        queryKey={['contact', queryParams]}
        pagination={pagination}
        onPaginationChange={setPagination}
        globalFilter={globalFilter}
        enableGlobalFilter={true}
        onGlobalFilterChange={setGlobalFilter}
        filters={filters}
        onFiltersChange={setFilters}
        searchPlaceholder={t('searchPlaceholder') ?? 'Buscar contatos...'}
        loadingMessage={t('loading') ?? 'Carregando...'}
        emptyMessage={t('noLogs') ?? 'Nenhum contato encontrado'}
        entityName={t('entity') ?? 'contato'}
        entityNamePlural={t('entityPlural') ?? 'contatos'}
      >
        {/* Área de Filtros e Configurações */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4">
          {/* Filtros à esquerda */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
            <DataTable.Input
              title={t('searchText')}
              placeholder={t('searchPlaceholder')}
            />
          </div>
      
        </div>
      </DataTable>
    </Container>
  )
}