'use client';

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type PaginationState,
  getGroupedRowModel,
  getExpandedRowModel,
  type ExpandedState,
  type OnChangeFn,
  getSortedRowModel,
  type SortingState,
  getFilteredRowModel,
} from '@tanstack/react-table';
import type { QueryKey } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StateMaster } from '@/components/state-master';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PaginatedResponse } from '@/lib/types/pagination.types';
import React, { useState, useMemo, useEffect, Fragment } from 'react';
import { useFilterSidebar } from '@/contexts/filter-sidebar-context';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ChevronDown,
  ChevronRight,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/use-translation';
import { createContext, useContext } from 'react';
import { Label } from './ui/label';

import { ListFilter } from 'lucide-react';
import { Container, ContainerVariant } from './container';
// Extensão do tipo ColumnDef para suportar agrupamento e layout mobile
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    groupBy?: boolean;
    groupLabel?: (value: TValue, groupData?: unknown) => string | React.ReactNode;
    hidden?: boolean;
    // Propriedades para layout mobile
    mobileWidth?: 'full' | 'half' | 'third'; // Largura da coluna no card mobile
    mobileOrder?: number; // Ordem de exibição no mobile (menor = primeiro)
    mobileHidden?: boolean; // Ocultar esta coluna no mobile
    mobileLabel?: string; // Label alternativo para mobile (se não informado, usa o header)
  }
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: PaginatedResponse<TData> | TData[] | undefined;
  error?: Error | null;
  queryKey: QueryKey;
  isLoading?: boolean;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  globalFilter?: string;
  onGlobalFilterChange?: OnChangeFn<string>;
  enableGlobalFilter?: boolean;
  filters?: Record<string, string>;
  onFiltersChange?: OnChangeFn<Record<string, string>>;
  searchPlaceholder?: string;
  loadingMessage?: string;
  emptyMessage?: string;
  entityName?: string;
  entityNamePlural?: string;
  enableGrouping?: boolean;
  children?: React.ReactNode;
  variant?: ContainerVariant
  border?: boolean
}

interface DataTableInputProps {
  title?: string;
  placeholder?: string;
  className?: string;
}

interface DataTableSelectProps<TData> {
  title?: string;
  accessorKey: keyof TData;
  placeholder?: string;
  className?: string;
}

// Context para compartilhar estado do filtro global entre DataTable e DataTable.Input/Select
export const DataTableContext = createContext<{
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  placeholder?: string;
  tableData: unknown[];
  columns: ColumnDef<unknown>[];
  data: PaginatedResponse<unknown> | unknown[] | undefined;
} | null>(null);

function DataTableInput({ placeholder, className, title }: DataTableInputProps) {
  const context = useContext(DataTableContext);
  const { t } = useTranslation('common');

  if (!context) {
    throw new Error('DataTable.Input must be used within DataTable');
  }

  // Debounce para o onChange
  const [inputValue, setInputValue] = useState(context.globalFilter);

  // Update inputValue only if context.globalFilter changes and is different from inputValue
  useEffect(() => {
    if (inputValue !== context.globalFilter) {
      setInputValue(context.globalFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.globalFilter]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (inputValue !== context.globalFilter) {
        context.setGlobalFilter(inputValue);
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [inputValue]);

  return (
    <div className={cn("grid gap-2", className)}>
      {title && <Label className={cn("data-[error=true]:text-destructive")}>{title}</Label>}
      <div className={cn("relative", className)}>
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={placeholder || context.placeholder || t('search')}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="pl-8 w-64"
        />
      </div>
    </div>
  );
}

function DataTableSelect<TData>({ accessorKey, placeholder, className, title }: DataTableSelectProps<TData>) {
  const context = useContext(DataTableContext);
  const { t } = useTranslation('common');

  if (!context) {
    throw new Error('DataTable.Select must be used within DataTable');
  }
  // Busca o valor do filtro pelo accessorKey, tipando corretamente

  // Extrai valores únicos da coluna especificada
  const uniqueValues = useMemo(() => {
    let values: string[] | undefined = undefined;
    if (context.data && 'filter' in context.data) {
      const filterObj = (context.data as PaginatedResponse<TData>).filter;
      if (filterObj && typeof filterObj === 'object') {
        values = filterObj[accessorKey as string];
      }
    }

    return values ? Array.from(values).sort() : undefined;
  }, [context.tableData, accessorKey]);

  if (uniqueValues === undefined) {
    return (
      <div className="px-3 py-2 text-muted-foreground text-sm">
        {t('filterValuesUnavailable')} - {accessorKey as string}
      </div>
    );
  }
  return (
    <div className={cn("grid gap-2", className)}>
      {title && <Label className={cn("data-[error=true]:text-destructive")}>{title}</Label>}
      <div className={cn("relative", className)}>
        <Select
          value={context.filters[accessorKey as string] || 'all'}
          onValueChange={(value) => {
            context.setFilter(accessorKey as string, value);
          }}
          disabled={uniqueValues.length === 0}

        >
          <SelectTrigger className={cn('w-[180px]', className)}>
            <SelectValue placeholder={placeholder || t('filter')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all') || 'Todos'}</SelectItem>
            {uniqueValues.map((value) => (
              <SelectItem key={value} value={value}>
                {t(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Componente para ações que devem ser renderizadas normalmente no mobile
function DataTableActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex gap-2", className)}>{children}</div>;
}

export function DataTable<TData>({
  columns,
  data,
  error,
  queryKey,
  isLoading,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  globalFilter,
  onGlobalFilterChange,
  enableGlobalFilter = false,
  filters,
  onFiltersChange,
  loadingMessage = 'Carregando...',
  emptyMessage = 'Nenhum registro encontrado',
  entityName = 'registro',
  entityNamePlural = 'registros',
  enableGrouping = false,
  children,
  searchPlaceholder,
  variant,
  border
}: DataTableProps<TData>) {
  const { t } = useTranslation('common');
  const isMobile = useIsMobile();
  border = border === undefined ? (isMobile ? false : border) : border;
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalGlobalFilter, setInternalGlobalFilter] = useState<string>('');
  const [internalFilters, setInternalFilters] = useState<Record<string, string>>({});

  // Usa o filtro externo se fornecido, caso contrário usa o interno
  const currentGlobalFilter = enableGlobalFilter ? (globalFilter ?? internalGlobalFilter) : '';
  const setCurrentGlobalFilter = enableGlobalFilter ? (onGlobalFilterChange ?? setInternalGlobalFilter) : setInternalGlobalFilter;

  // Gerencia filtros por coluna
  const currentFilters = filters ?? internalFilters;
  const setCurrentFilters = onFiltersChange ?? setInternalFilters;

  const setFilter = (key: string, value: string) => {
    setCurrentFilters((prev) => {
      if (!value || value === 'all') {
        const newFilters = { ...prev };
        delete newFilters[key];
        return newFilters;
      }
      return { ...prev, [key]: value };
    });
  };

  // Considera loading quando data é undefined ou quando isLoading é true
  const isActuallyLoading = isLoading || data === undefined;

  const isPaginated = data && 'meta' in data;
  const tableData = isPaginated ? (data as PaginatedResponse<TData>).data : (data as TData[]) || [];
  const meta = isPaginated ? (data as PaginatedResponse<TData>).meta : null;

  // Encontra automaticamente colunas marcadas para agrupamento
  const groupByColumns = useMemo(() => {
    if (!enableGrouping) return [];
    return columns
      .filter((col) => col.meta?.groupBy === true)
      .map((col) => {
        if ('accessorKey' in col) {
          return col.accessorKey as string;
        }
        if ('id' in col) {
          return col.id as string;
        }
        return null;
      })
      .filter(Boolean) as string[];
  }, [columns, enableGrouping]);

  const grouping = useMemo(() => {
    if (enableGrouping && groupByColumns.length > 0) {
      return groupByColumns;
    }
    return [];
  }, [enableGrouping, groupByColumns]);

  const table = useReactTable({
    data: tableData,
    columns,
    pageCount: meta?.totalPages ?? 0,
    state: {
      pagination,
      sorting: sorting ?? internalSorting,
      grouping: enableGrouping ? grouping : [],
      expanded: enableGrouping ? expanded : {},
      globalFilter: currentGlobalFilter,
    },
    onPaginationChange,
    onSortingChange: onSortingChange ?? setInternalSorting,
    onExpandedChange: enableGrouping ? setExpanded : undefined,
    onGlobalFilterChange: setCurrentGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: enableGlobalFilter ? getFilteredRowModel() : undefined,
    getGroupedRowModel: enableGrouping ? getGroupedRowModel() : undefined,
    getExpandedRowModel: enableGrouping ? getExpandedRowModel() : undefined,
    manualPagination: true,
    enableGlobalFilter,
    enableGrouping,
    globalFilterFn: 'includesString',
  });

  const { open: openSidebar } = useFilterSidebar();

  const dataTableContextValue = {
    globalFilter: currentGlobalFilter,
    setGlobalFilter: setCurrentGlobalFilter,
    filters: currentFilters,
    setFilter,
    placeholder: searchPlaceholder,
    tableData: tableData as unknown[],
    columns: columns as ColumnDef<unknown>[],
    data
  };

  return (
    <DataTableContext.Provider value={dataTableContextValue}>
      <div className="space-y-6">
        <StateMaster
          queryKey={queryKey}
          isLoading={isActuallyLoading}
          loadingMessage={loadingMessage}
          useTableSkeleton={true}
          skeletonRows={pagination.pageSize || 10}
          skeletonColumns={columns.filter((col) => !col.meta?.hidden).length}
        >
          <Container variant={variant} border={border}>
            {/* Desktop: mostra no local, Mobile: botão para abrir sidebar global */}
            {children && (() => {
              // Separa os children em filtros e ações
              const childrenArray = React.Children.toArray(children);
              const filters: React.ReactNode[] = [];
              const actions: React.ReactNode[] = [];

              childrenArray.forEach((child) => {
                if (React.isValidElement(child) && child.type === DataTableActions) {
                  actions.push(child);
                } else {
                  filters.push(child);
                }
              });

              const hasFilters = filters.length > 0;
              const hasActions = actions.length > 0;

              return (
                <>
                  {/* Desktop: mostra tudo junto */}
                  <div className="border-b pb-2 pt-2 flex flex-row gap-2 items-center mb-4 hidden lg:flex">
                    {children}
                  </div>
                  
                  {/* Mobile: separa filtros (sidebar) e ações (inline) */}
                  <div className="flex lg:hidden flex-row justify-start gap-2 mb-2">
                    {hasActions && actions}
                    {hasFilters && (
                      <Button
                        type="button"
                        onClick={() => openSidebar(<>{filters}</>, t('filters'), dataTableContextValue)}
                        aria-label="Abrir filtros"
                      >
                        <ListFilter/>
                      </Button>
                    )}
                   
                  </div>
                </>
              );
            })()}
            {error && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 mb-4">
                  <span className="text-destructive text-xl">⚠</span>
                </div>
                <p className="text-destructive font-medium">
                  {error instanceof Error ? error.message : 'Erro ao carregar dados'}
                </p>
              </div>
            )}

            {!error && tableData.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted border border-border mb-4">
                  <span className="text-muted-foreground text-xl">📋</span>
                </div>
                <p className="text-muted-foreground font-medium">{emptyMessage || t('noRecords')}</p>
              </div>
            )}

            {!error && tableData.length > 0 && (
              <div className="space-y-6">
                {isMobile ? (
                  /* Renderização Mobile - Cards */
                  <div className="space-y-4">
                    {table.getRowModel().rows.map((row) => {
                      // Filtra e ordena as células para mobile
                      const mobileCells = row.getVisibleCells()
                        .filter((cell) => {
                          const meta = cell.column.columnDef.meta;
                          return !meta?.hidden && !meta?.mobileHidden;
                        })
                        .sort((a, b) => {
                          const orderA = a.column.columnDef.meta?.mobileOrder ?? 999;
                          const orderB = b.column.columnDef.meta?.mobileOrder ?? 999;
                          return orderA - orderB;
                        });

                      return (
                        <Container variant='default' padding={true} key={row.id}>
                          <div className="grid grid-cols-12 gap-x-3 gap-y-1 items-stretch">
                            {mobileCells.map((cell, idx) => {
                              const meta = cell.column.columnDef.meta;
                              const mobileWidth = meta?.mobileWidth ?? 'full';
                              // Define as classes de grid baseado na largura
                              const widthClass = {
                                full: 'col-span-12',
                                half: 'col-span-6',
                                third: 'col-span-4',
                              }[mobileWidth];
                              // Para o header, busca no headerGroup correspondente
                              const headerGroup = table.getHeaderGroups()[0];
                              const header = headerGroup?.headers.find(h => h.column.id === cell.column.id);
                              // Usa o mobileLabel se disponível, senão usa o header normal
                              const label = meta?.mobileLabel || 
                                (header ? flexRender(cell.column.columnDef.header, header.getContext()) : cell.column.id);

                              return (
                                <div key={cell.id} className={cn(widthClass, "flex flex-col h-full justify-between")}> 
                                  <div className="text-xs font-semibold text-muted-foreground mb-0.5">
                                    {label}
                                  </div>
                                  <div className="mb-2 text-sm flex-1 flex items-center">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                  </div>
                                
                                </div>
                              );
                            })}
                          </div>
                        </Container>
                      );
                    })}
                    {meta && (
                      <div className="flex px-1 pt-2 items-center justify-between border-t border-border/30 pt-4">
                        <div className="text-sm text-muted-foreground font-medium">
                          <span className="font-semibold text-foreground">{meta.page}</span> / <span className="font-semibold text-foreground">{meta.totalPages}</span>
                          {' '}(<span className="font-semibold text-foreground">{meta.total}</span>{' '}
                          {meta.total === 1 ? entityName : entityNamePlural})
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                          >
                            {t('previous')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                          >
                            {t('next')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Renderização Desktop - Tabela */
                  <>
                    <Table className="relative">
                      <TableHeader className="bg-gradient-to-r from-primary-100 dark:from-primary-900/30 to-primary-50 dark:to-primary-950/20 border-b border-border/30">
                        {table.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id} className="hover:bg-primary-100/50 dark:hover:bg-primary-900/20 border-border/20">
                            {headerGroup.headers
                              .filter((header) => !header.column.columnDef.meta?.hidden)
                              .map((header) => (
                                <TableHead key={header.id} className="p-0 font-semibold text-primary-700 dark:text-primary-300 border-r border-border/20 last:border-r-0">
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                </TableHead>
                              ))}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody className="divide-y divide-border/20">
                        {table.getRowModel().rows.map((row, index) => {
                          // Se é uma linha de grupo
                          if (row.getIsGrouped()) {
                            const groupingValue = row.getGroupingValue(row.groupingColumnId!);
                            const groupColumn = columns.find((col) => {
                              if ('accessorKey' in col) return col.accessorKey === row.groupingColumnId;
                              if ('id' in col) return col.id === row.groupingColumnId;
                              return false;
                            });

                            const firstSubRow = row.subRows?.[0];
                            const groupData = {
                              ...firstSubRow,
                              allSubRows: row.subRows || [],
                              groupValue: groupingValue,
                            };

                            const groupLabel = groupColumn?.meta?.groupLabel
                              ? groupColumn.meta.groupLabel(groupingValue as never, groupData)
                              : `${row.groupingColumnId}: ${groupingValue}`;

                            return (
                              <TableRow
                                key={row.id}
                                className="bg-warning-100 dark:bg-warning-900/20 font-medium hover:bg-warning-200 dark:hover:bg-warning-900/30 cursor-pointer border-border/20"
                                onClick={() => row.toggleExpanded()}
                              >
                                <TableCell
                                  colSpan={columns.filter((col) => !col.meta?.hidden).length}
                                  className="p-0 py-3"
                                >
                                  <div className="flex items-center gap-2">
                                    {row.getIsExpanded() ? (
                                      <ChevronDown className="h-4 w-4 text-warning-600 dark:text-warning-400" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-warning-600 dark:text-warning-400" />
                                    )}
                                    {typeof groupLabel === 'string' ? (
                                      <span className="text-warning-700 dark:text-warning-300">{groupLabel}</span>
                                    ) : (
                                      groupLabel
                                    )}
                                    <span className="text-warning-600 dark:text-warning-400 text-sm">
                                      ({row.subRows?.length} itens)
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          }

                          // Linha normal
                          return (
                            <TableRow
                              key={row.id}
                              className={cn(
                                'hover:bg-info-50 dark:hover:bg-info-950/20 transition-colors border-border/10',
                                {
                                  'bg-info-50/30 dark:bg-info-950/5': index % 2 === 1,
                                  'bg-transparent': index % 2 === 0,
                                }
                              )}
                            >
                              {row
                                .getVisibleCells()
                                .filter((cell) => !cell.column.columnDef.meta?.hidden)
                                .map((cell) => {
                                  // Não renderiza células agrupadas (elas são mostradas no cabeçalho do grupo)
                                  if (cell.getIsGrouped()) {
                                    return null;
                                  }

                                  return (
                                    <TableCell key={cell.id} className="p-0 border-r border-border/20 last:border-r-0 py-2">
                                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                  );
                                })}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    {meta && (
                      <div className="flex px-1 pt-2 items-center justify-between bg-gradient-to-r from-success-50 dark:from-success-950/20 to-success-100 dark:to-success-900/20 border-t border-border/30 backdrop-blur-sm">
                        <div className="text-sm text-success-700 dark:text-success-300 font-medium">
                          <span className="hidden lg:inline">{t('page')} </span> <span className="text-success-800 dark:text-success-200 font-semibold">{meta.page}</span> {t('of')} <span className="text-success-800 dark:text-success-200 font-semibold">{meta.totalPages}</span>
                          {' '}(<span className="text-success-800 dark:text-success-200 font-semibold">{meta.total}</span>{' '}
                          {meta.total === 1 ? entityName : entityNamePlural})
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                          >
                            {t('previous')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                          >
                            {t('next')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </Container>
        </StateMaster>
      </div>
    </DataTableContext.Provider>
  );
}

// Exporta o subcomponente Input
DataTable.Input = DataTableInput;

// Exporta o subcomponente Select
DataTable.Select = DataTableSelect;

// Exporta o subcomponente Actions
DataTable.Actions = DataTableActions;
