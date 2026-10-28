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
  type Row,
  type HeaderGroup,
  type Table as TableInstance,
  type Cell,
  type ColumnMeta,
} from '@tanstack/react-table';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
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
import { TableSkeleton } from '@/components/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PaginatedResponse } from '@/lib/types/pagination.types';
import React, { useState, useMemo, useEffect, useCallback, createContext, useContext, Fragment } from 'react';
import { useFilterSidebar } from '@/contexts/filter-sidebar-context';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/hooks/use-translation';
import { useScreenItem } from '@/components/agent/screen-registry';
import { Label } from './ui/label';

import { ListFilter } from 'lucide-react';
import { Container } from './container';
// Extensão do tipo ColumnDef para suportar agrupamento e layout mobile
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    isAction?: boolean;
    groupBy?: boolean;
    groupLabel?: (value: TValue, groupData?: unknown) => string | React.ReactNode;
    hidden?: boolean;
    // Propriedades para layout mobile
    mobileWidth?: 'full' | 'half' | 'third'; // Largura da coluna no card mobile
    mobileOrder?: number; // Ordem de exibição no mobile (menor = primeiro)
    mobileHidden?: boolean; // Ocultar esta coluna no mobile
    mobileLabel?: string; // Label alternativo para mobile (se não informado, usa o header)
    mobileCollapse?: boolean; // Colapsar por padrão dentro de "Ver detalhes"
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
  emptyMessage?: string;
  entityName?: string;
  entityNamePlural?: string;
  enableGrouping?: boolean;
  children?: React.ReactNode;
  full?: boolean
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
  /** Substitui a derivação de `response.filter` por pares value/label explícitos (ex.: UUID → nome de exibição). */
  options?: { value: string; label: string }[];
}

export interface DataTableContextType {
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  resetFilters?: () => void;
  placeholder?: string;
  tableData: unknown[];
  columns: ColumnDef<unknown>[];
  data: PaginatedResponse<unknown> | unknown[] | undefined;
}

// Context para compartilhar estado do filtro global entre DataTable e DataTable.Input/Select
export const DataTableContext = createContext<DataTableContextType | null>(null);

function DataTableInput({ placeholder, className, title }: DataTableInputProps) {
  const context = useContext(DataTableContext);
  const { t } = useTranslation('common');

  if (!context) {
    throw new Error('DataTable.Input must be used within DataTable');
  }

  // Debounce para o onChange
  const [inputValue, setInputValue] = useState(context.globalFilter);
  const [prevGlobalFilter, setPrevGlobalFilter] = useState(context.globalFilter);

  // Sincroniza inputValue quando context.globalFilter muda por fora (ex: limpar filtros) —
  // ajuste de estado durante o render (não em effect) evita o commit extra
  if (context.globalFilter !== prevGlobalFilter) {
    setPrevGlobalFilter(context.globalFilter);
    setInputValue(context.globalFilter);
  }

  const { globalFilter: ctxGlobalFilter, setGlobalFilter } = context;
  useEffect(() => {
    const handler = setTimeout(() => {
      if (inputValue !== ctxGlobalFilter) {
        setGlobalFilter(inputValue);
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [inputValue, ctxGlobalFilter, setGlobalFilter]);

  return (
    <div className={cn("grid gap-1.5 shrink-0 min-w-0", className)}>
      {title && <Label className={cn("data-[error=true]:text-destructive")}>{title}</Label>}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={placeholder || context.placeholder || t('search')}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          // w-full on mobile drawer, responsive width on desktop toolbar
          className="pl-8 w-full sm:w-52 lg:w-48 xl:w-56 2xl:w-64 min-w-0"
        />
      </div>
    </div>
  );
}

function DataTableSelect<TData>({ accessorKey, placeholder, className, title, options }: DataTableSelectProps<TData>) {
  const context = useContext(DataTableContext);
  const { t } = useTranslation('common');

  if (!context) {
    throw new Error('DataTable.Select must be used within DataTable');
  }
  // Busca o valor do filtro pelo accessorKey, tipando corretamente

  // Sem `options`, extrai valores únicos da coluna a partir de response.filter (comportamento original)
  const uniqueValues = useMemo(() => {
    if (options) return undefined;
    let values: string[] | undefined = undefined;
    if (context.data && 'filter' in context.data) {
      const filterObj = (context.data as PaginatedResponse<TData>).filter;
      if (filterObj && typeof filterObj === 'object') {
        values = filterObj[accessorKey as string];
      }
    }

    return values ? Array.from(values).sort() : undefined;
  }, [context.data, accessorKey, options]);

  const selectOptions = options ?? uniqueValues?.map((value) => ({ value, label: t(value) }));

  if (selectOptions === undefined) {
    return (
      <div className="px-3 py-2 text-muted-foreground text-sm">
        {t('filterValuesUnavailable')} - {accessorKey as string}
      </div>
    );
  }
  return (
    <div className={cn("grid gap-1.5 shrink-0 min-w-0", className)}>
      {title && <Label className={cn("data-[error=true]:text-destructive")}>{title}</Label>}
      <div className="relative">
        <Select
          value={context.filters[accessorKey as string] || 'all'}
          onValueChange={(value) => {
            context.setFilter(accessorKey as string, value);
          }}
          disabled={selectOptions.length === 0}

        >
          {/* w-full on mobile drawer, responsive width on desktop toolbar */}
          <SelectTrigger className={cn('w-full sm:w-[150px] lg:w-[145px] xl:w-[160px] 2xl:w-[180px]', className)}>
            <SelectValue placeholder={placeholder || t('filter')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all') || 'Todos'}</SelectItem>
            {selectOptions.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
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
  return <div className={cn("flex items-center gap-2 shrink-0 self-center", className, "lg:w-auto lg:ml-auto")}>{children}</div>;
}

function useDataTableFilters({
  enableGlobalFilter,
  globalFilter,
  onGlobalFilterChange,
  filters,
  onFiltersChange,
}: {
  enableGlobalFilter: boolean;
  globalFilter?: string;
  onGlobalFilterChange?: (v: string) => void;
  filters?: Record<string, string>;
  onFiltersChange?: (v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
}) {
  const [internalGlobalFilter, setInternalGlobalFilter] = useState<string>('');
  const [internalFilters, setInternalFilters] = useState<Record<string, string>>({});

  const currentGlobalFilter = enableGlobalFilter ? (globalFilter ?? internalGlobalFilter) : '';
  const setCurrentGlobalFilter = enableGlobalFilter
    ? (onGlobalFilterChange ?? setInternalGlobalFilter)
    : setInternalGlobalFilter;

  const currentFilters = filters ?? internalFilters;
  const setCurrentFilters = onFiltersChange ?? setInternalFilters;

  const setFilter = (key: string, value: string) => {
    setCurrentFilters((prev) => {
      if (!value || value === 'all') {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  };

  const resetFilters = useCallback(() => {
    setCurrentFilters({});
    setCurrentGlobalFilter('');
  }, [setCurrentFilters, setCurrentGlobalFilter]);

  return {
    currentGlobalFilter,
    setCurrentGlobalFilter,
    currentFilters,
    setFilter,
    resetFilters,
  };
}

function useDataTableGrouping<TData>(
  columns: ColumnDef<TData, unknown>[],
  enableGrouping: boolean,
) {
  const groupByColumns = useMemo(() => {
    if (!enableGrouping) return [];
    return columns
      .filter((col) => col.meta?.groupBy === true)
      .map((col) => {
        if ('accessorKey' in col) return col.accessorKey as string;
        if ('id' in col) return col.id as string;
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

  return grouping;
}

function resolveTableData<TData>(data: PaginatedResponse<TData> | TData[] | undefined) {
  const isPaginated = Boolean(data && 'meta' in data);
  const tableData = isPaginated
    ? (data as PaginatedResponse<TData>).data
    : (data as TData[]) || [];
  const meta = isPaginated ? (data as PaginatedResponse<TData>).meta : null;
  return { tableData, meta };
}

function DataTableToolbar({
  children,
  dataTableContextValue,
  t,
}: {
  children?: React.ReactNode;
  dataTableContextValue: DataTableContextType;
  t: (k: string) => string;
}) {
  const { open: openSidebar, update: updateSidebar, isOpen: isSidebarOpen } = useFilterSidebar();

  const { filterNodes, actionNodes } = useMemo(() => {
    if (!children) return { filterNodes: [], actionNodes: [] };
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

    return { filterNodes: filters, actionNodes: actions };
  }, [children]);

  const hasFilters = filterNodes.length > 0;
  const hasActions = actionNodes.length > 0;

  useEffect(() => {
    if (isSidebarOpen && hasFilters) {
      updateSidebar(<>{filterNodes}</>, dataTableContextValue);
    }
  }, [isSidebarOpen, hasFilters, dataTableContextValue, filterNodes, updateSidebar]);

  if (!children) return null;

  return (
    <>
      <div className="border-b pb-2 pt-2 flex flex-wrap gap-2 sm:gap-3 items-center mb-4 hidden lg:flex w-full min-w-0">
        {children}
      </div>
      <div className="flex lg:hidden flex-row justify-start gap-2 mb-2">
        {hasActions && actionNodes}
        {hasFilters && (
          <Button
            type="button"
            onClick={() => openSidebar(<>{filterNodes}</>, t('filters'), dataTableContextValue)}
            aria-label={t('filters')}
          >
            <ListFilter />
          </Button>
        )}
      </div>
    </>
  );
}

function DataTableEmptyOrError({
  error,
  isEmpty,
  emptyMessage,
  t,
}: {
  error?: Error | null;
  isEmpty: boolean;
  emptyMessage?: string;
  t: (k: string) => string;
}) {
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 mb-4">
          <span className="text-destructive text-xl">⚠</span>
        </div>
        <p className="text-destructive font-medium">
          {error.message || 'Erro ao carregar dados'}
        </p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted border border-border mb-4">
          <span className="text-muted-foreground text-xl">📋</span>
        </div>
        <p className="text-muted-foreground font-medium">{emptyMessage || t('noRecords')}</p>
      </div>
    );
  }

  return null;
}

function isActionColumn(id: string, meta?: ColumnMeta<unknown, unknown>): boolean {
  if (meta?.isAction !== undefined) return meta.isAction;
  const lower = id.toLowerCase();
  return lower === 'actions' || lower === 'operations';
}

function isCollapsibleColumn(id: string, index: number, meta?: ColumnMeta<unknown, unknown>): boolean {
  if (meta?.mobileCollapse !== undefined) return meta.mobileCollapse;
  const lower = id.toLowerCase();
  if (lower.includes('created') || lower.includes('updated') || lower === 'metadata' || lower === 'id') {
    return true;
  }
  return index >= 3;
}

function DataTableMobileCellItem<TData>({
  cell,
  headerGroup,
  isSecondary = false,
}: {
  cell: Cell<TData, unknown>;
  headerGroup?: HeaderGroup<TData>;
  isSecondary?: boolean;
}) {
  const meta = cell.column.columnDef.meta;
  const mobileWidth = meta?.mobileWidth ?? 'full';
  const widthClass = {
    full: 'col-span-12',
    half: 'col-span-6',
    third: 'col-span-4',
  }[mobileWidth];
  const header = headerGroup?.headers.find((h) => h.column.id === cell.column.id);
  const label = meta?.mobileLabel ||
    (header ? flexRender(cell.column.columnDef.header, header.getContext()) : cell.column.id);

  return (
    <div className={cn(widthClass, "flex flex-col min-w-0 max-w-full overflow-hidden")}>
      <div className={cn(
        "font-semibold uppercase tracking-wider text-muted-foreground/75 mb-0.5 select-none truncate",
        isSecondary ? "text-[10px]" : "text-[11px]"
      )}>
        {label}
      </div>
      <div className={cn(
        "font-medium text-foreground min-w-0 max-w-full overflow-hidden [overflow-wrap:anywhere] break-all sm:break-words [&_.table-cell]:!inline [&_.table-cell]:!whitespace-normal [&_.table-cell]:!max-w-full [&_*]:max-w-full",
        isSecondary ? "text-xs font-normal" : "text-sm"
      )}>
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </div>
    </div>
  );
}

function DataTableMobileCardFooter<TData>({
  hasCollapsible,
  expanded,
  onToggleExpanded,
  actionCell,
  t,
}: {
  hasCollapsible: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  actionCell?: Cell<TData, unknown>;
  t: (k: string) => string;
}) {
  if (!hasCollapsible && !actionCell) return null;

  const showLessTranslated = t('showLess');
  const showMoreTranslated = t('showMore');
  const lessLabel = showLessTranslated && showLessTranslated !== 'showLess' ? showLessTranslated : 'Menos detalhes';
  const moreLabel = showMoreTranslated && showMoreTranslated !== 'showMore' ? showMoreTranslated : 'Ver detalhes';

  return (
    <div className="border-t border-border/40 pt-2.5 mt-2 flex items-center justify-between min-h-[38px] gap-2">
      {hasCollapsible ? (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 py-1 px-1.5 -ml-1 rounded-md hover:bg-muted/70 transition-colors cursor-pointer select-none"
        >
          {expanded ? (
            <>
              <ChevronUp className="size-3.5 text-muted-foreground" />
              <span>{lessLabel}</span>
            </>
          ) : (
            <>
              <ChevronDown className="size-3.5 text-muted-foreground" />
              <span>{moreLabel}</span>
            </>
          )}
        </button>
      ) : <div />}

      {actionCell && (
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {flexRender(actionCell.column.columnDef.cell, actionCell.getContext())}
        </div>
      )}
    </div>
  );
}

function DataTableMobileRow<TData>({
  row,
  headerGroup,
  t,
}: {
  row: Row<TData>;
  headerGroup?: HeaderGroup<TData>;
  t: (k: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);

  const visibleCells = row.getVisibleCells()
    .filter((cell) => {
      const meta = cell.column.columnDef.meta;
      return !meta?.hidden && !meta?.mobileHidden;
    })
    .sort((a, b) => {
      const orderA = a.column.columnDef.meta?.mobileOrder ?? 999;
      const orderB = b.column.columnDef.meta?.mobileOrder ?? 999;
      return orderA - orderB;
    });

  const actionCell = visibleCells.find((c) => isActionColumn(c.column.id, c.column.columnDef.meta));
  const dataCells = visibleCells.filter((c) => !isActionColumn(c.column.id, c.column.columnDef.meta));

  const primaryCells = dataCells.filter((c, i) => !isCollapsibleColumn(c.column.id, i, c.column.columnDef.meta));
  const collapsibleCells = dataCells.filter((c, i) => isCollapsibleColumn(c.column.id, i, c.column.columnDef.meta));

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs transition-shadow w-full min-w-0 max-w-full overflow-hidden">
      <div className="grid grid-cols-12 gap-x-3 gap-y-2 items-start w-full min-w-0 max-w-full overflow-hidden">
        {primaryCells.map((cell) => (
          <DataTableMobileCellItem key={cell.id} cell={cell} headerGroup={headerGroup} />
        ))}
      </div>

      {expanded && collapsibleCells.length > 0 && (
        <div className="pt-2.5 mt-2 border-t border-dashed border-border/50 grid grid-cols-12 gap-x-3 gap-y-2.5 w-full min-w-0 max-w-full overflow-hidden animate-in fade-in-50 duration-200">
          {collapsibleCells.map((cell) => (
            <DataTableMobileCellItem key={cell.id} cell={cell} headerGroup={headerGroup} isSecondary={true} />
          ))}
        </div>
      )}

      <DataTableMobileCardFooter
        hasCollapsible={collapsibleCells.length > 0}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((prev) => !prev)}
        actionCell={actionCell}
        t={t}
      />
    </div>
  );
}

function DataTableMobileView<TData>({
  table,
  meta,
  entityName,
  entityNamePlural,
  t,
}: {
  table: TableInstance<TData>;
  meta?: PaginatedResponse<TData>['meta'] | null;
  entityName: string;
  entityNamePlural: string;
  t: (k: string) => string;
}) {
  const headerGroup = table.getHeaderGroups()[0];
  return (
    <div className="space-y-3">
      {table.getRowModel().rows.map((row) => (
        <DataTableMobileRow key={row.id} row={row} headerGroup={headerGroup} t={t} />
      ))}
      {meta && (
        <div className="flex px-1 items-center justify-between border-t border-border/30 pt-3 pb-24 sm:pb-2">
          <div className="text-sm text-muted-foreground font-medium">
            <span className="font-semibold text-foreground">{meta.page}</span> / <span className="font-semibold text-foreground">{meta.totalPages}</span>
            {' '}(<span className="font-semibold text-foreground">{meta.total}</span>{' '}
            {meta.total === 1 ? entityName : entityNamePlural})
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-3.5 min-w-[76px] touch-manipulation font-medium cursor-pointer"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              {t('previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-3.5 min-w-[76px] touch-manipulation font-medium cursor-pointer"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              {t('next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DataTableDesktopGroupRow<TData>({
  row,
  columns,
}: {
  row: Row<TData>;
  columns: ColumnDef<TData, unknown>[];
}) {
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

function DataTableDesktopView<TData>({
  table,
  columns,
  meta,
  entityName,
  entityNamePlural,
  t,
}: {
  table: TableInstance<TData>;
  columns: ColumnDef<TData, unknown>[];
  meta?: PaginatedResponse<TData>['meta'] | null;
  entityName: string;
  entityNamePlural: string;
  t: (k: string) => string;
}) {
  return (
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
            if (row.getIsGrouped()) {
              return <DataTableDesktopGroupRow key={row.id} row={row} columns={columns} />;
            }

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
                    if (cell.getIsGrouped()) return null;
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
            <span className="hidden lg:inline">{t('page')} </span>{' '}
            <span className="text-success-800 dark:text-success-200 font-semibold">{meta.page}</span>{' '}
            {t('of')}{' '}
            <span className="text-success-800 dark:text-success-200 font-semibold">{meta.totalPages}</span>{' '}
            (<span className="text-success-800 dark:text-success-200 font-semibold">{meta.total}</span>{' '}
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
  );
}

function buildReactTableState({
  pagination,
  sorting,
  internalSorting,
  enableGrouping,
  grouping,
  expanded,
  currentGlobalFilter,
}: {
  pagination: PaginationState;
  sorting?: SortingState;
  internalSorting: SortingState;
  enableGrouping: boolean;
  grouping: string[];
  expanded: ExpandedState;
  currentGlobalFilter: string;
}) {
  return {
    pagination,
    sorting: sorting ?? internalSorting,
    grouping: enableGrouping ? grouping : [],
    expanded: enableGrouping ? expanded : {},
    globalFilter: currentGlobalFilter,
  };
}

function useDataTableInstance<TData>({
  columns,
  data,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  enableGlobalFilter,
  enableGrouping,
  currentGlobalFilter,
  setCurrentGlobalFilter,
}: {
  columns: ColumnDef<TData, unknown>[];
  data: PaginatedResponse<TData> | TData[] | undefined;
  pagination: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  enableGlobalFilter: boolean;
  enableGrouping: boolean;
  currentGlobalFilter: string;
  setCurrentGlobalFilter: (filter: string) => void;
}) {
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const { tableData, meta } = resolveTableData(data);
  const grouping = useDataTableGrouping(columns, enableGrouping);

  const state = buildReactTableState({
    pagination,
    sorting,
    internalSorting,
    enableGrouping,
    grouping,
    expanded,
    currentGlobalFilter,
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: tableData,
    columns,
    pageCount: meta?.totalPages ?? 0,
    state,
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

  return { table, tableData, meta };
}

function DataTableBodyView<TData>({
  hasRows,
  isMobile,
  table,
  columns,
  meta,
  entityName,
  entityNamePlural,
  t,
}: {
  hasRows: boolean;
  isMobile: boolean;
  table: TableInstance<TData>;
  columns: ColumnDef<TData, unknown>[];
  meta?: PaginatedResponse<TData>['meta'] | null;
  entityName: string;
  entityNamePlural: string;
  t: (k: string) => string;
}) {
  if (!hasRows) return null;
  return (
    <div className="space-y-6">
      {isMobile ? (
        <DataTableMobileView
          table={table}
          meta={meta}
          entityName={entityName}
          entityNamePlural={entityNamePlural}
          t={t}
        />
      ) : (
        <DataTableDesktopView
          table={table}
          columns={columns}
          meta={meta}
          entityName={entityName}
          entityNamePlural={entityNamePlural}
          t={t}
        />
      )}
    </div>
  );
}

function useDataTableStateAndContext<TData>(props: DataTableProps<TData>) {
  const {
    columns,
    data,
    pagination,
    onPaginationChange,
    sorting,
    onSortingChange,
    globalFilter,
    onGlobalFilterChange,
    filters,
    onFiltersChange,
    searchPlaceholder,
  } = props;
  const enableGlobalFilter = Boolean(props.enableGlobalFilter);
  const enableGrouping = Boolean(props.enableGrouping);

  const {
    currentGlobalFilter,
    setCurrentGlobalFilter,
    currentFilters,
    setFilter,
    resetFilters,
  } = useDataTableFilters({
    enableGlobalFilter,
    globalFilter,
    onGlobalFilterChange,
    filters,
    onFiltersChange,
  });

  const { table, tableData, meta } = useDataTableInstance({
    columns: columns as ColumnDef<TData, unknown>[],
    data,
    pagination,
    onPaginationChange,
    sorting,
    onSortingChange,
    enableGlobalFilter,
    enableGrouping,
    currentGlobalFilter,
    setCurrentGlobalFilter,
  });

  const contextValue: DataTableContextType = {
    globalFilter: currentGlobalFilter,
    setGlobalFilter: setCurrentGlobalFilter,
    filters: currentFilters,
    setFilter,
    resetFilters,
    placeholder: searchPlaceholder,
    tableData: tableData as unknown[],
    columns: columns as ColumnDef<unknown>[],
    data,
  };

  return { table, tableData, meta, contextValue };
}

function getTableLoadingOrError<TData>({
  queryClient,
  queryKey,
  isLoading,
  data,
  pagination,
  columns,
  resolvedBorder,
  isMobile,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  queryKey: QueryKey;
  isLoading?: boolean;
  data: unknown;
  pagination: PaginationState;
  columns: ColumnDef<TData, unknown>[];
  resolvedBorder: boolean;
  isMobile: boolean;
}) {
  const queryError = queryClient.getQueryState(queryKey)?.error;
  if (queryError) {
    return (
      <ErrorState onRetry={() => queryClient.refetchQueries({ queryKey })} />
    );
  }

  if (isLoading || data === undefined) {
    return (
      <div className="space-y-2 sm:space-y-4 md:space-y-6">
        <Container border={resolvedBorder} padding={!isMobile}>
          <TableSkeleton
            rows={pagination.pageSize || 10}
            columns={columns.filter((col) => !col.meta?.hidden).length}
          />
        </Container>
      </div>
    );
  }

  return null;
}

export function DataTable<TData>(props: DataTableProps<TData>) {
  const {
    columns,
    data,
    error,
    queryKey,
    isLoading,
    pagination,
    children,
    border,
  } = props;
  const emptyMessage = props.emptyMessage ?? 'Nenhum registro encontrado';
  const entityName = props.entityName ?? 'registro';
  const entityNamePlural = props.entityNamePlural ?? 'registros';

  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  useScreenItem('collection', String(queryKey[0] ?? ''));
  const isMobile = useIsMobile();
  const resolvedBorder = border === undefined ? !isMobile : border;

  const { table, tableData, meta, contextValue } = useDataTableStateAndContext(props);

  const loadingOrError = getTableLoadingOrError({
    queryClient,
    queryKey,
    isLoading,
    data,
    pagination,
    columns: columns as ColumnDef<TData, unknown>[],
    resolvedBorder,
    isMobile,
  });
  if (loadingOrError) return loadingOrError;

  return (
    <DataTableContext.Provider value={contextValue}>
      <div className="space-y-2 sm:space-y-4 md:space-y-6">
        <Container border={resolvedBorder} padding={!isMobile}>
          <DataTableToolbar
            dataTableContextValue={contextValue}
            t={t}
          >
            {children}
          </DataTableToolbar>

          <DataTableEmptyOrError
            error={error}
            isEmpty={!error && tableData.length === 0}
            emptyMessage={emptyMessage}
            t={t}
          />

          <DataTableBodyView
            hasRows={!error && tableData.length > 0}
            isMobile={isMobile}
            table={table}
            columns={columns as ColumnDef<TData, unknown>[]}
            meta={meta}
            entityName={entityName}
            entityNamePlural={entityNamePlural}
            t={t}
          />
        </Container>
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
