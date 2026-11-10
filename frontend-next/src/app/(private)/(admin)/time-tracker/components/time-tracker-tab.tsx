'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  useTimeEntries,
  useDeleteTimeEntry,
  useStartTimer,
  useStopTimer,
  useActiveTimer,
  useExportTimeEntries,
} from '@/lib/actions/time-tracking/queries';
import { useProjects } from '@/lib/actions/project/queries';
import { getTimeTrackingColumns, formatDuration } from './time-tracker-columns';
import { StartTimerModal } from '@/components/time-tracking/start-timer-modal';
import { EditTimeEntryDialog } from './edit-time-entry-dialog';
import { ManualEntryDialog } from './manual-entry-dialog';
import { TimeTrackerDateFilter } from './time-tracker-date-filter';
import type { TimeEntry } from '@/lib/actions/time-tracking/types';
import { buildTableQueryParams } from '@/lib/table-query-params';
import { toast } from 'sonner';
import {
  Play,
  PlusCircle,
  Clock,
  Briefcase,
  Download,
  ChevronDown,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function TimeTrackerTab() {
  const { t } = useTranslation('time-tracking');

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  const { data: activeTimerData } = useActiveTimer();
  const startTimerMutation = useStartTimer();
  const stopTimerMutation = useStopTimer();
  const deleteMutation = useDeleteTimeEntry();
  const exportMutation = useExportTimeEntries();

  const queryParams = buildTableQueryParams(pagination, globalFilter, filters);
  const { data, error, isLoading } = useTimeEntries(queryParams as Parameters<typeof useTimeEntries>[0]);
  const { data: projectsData } = useProjects({ limit: 50 });

  const entries: TimeEntry[] = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return (data as { data?: TimeEntry[] })?.data ?? (data as { items?: TimeEntry[] })?.items ?? [];
  }, [data]);

  const projects = useMemo(() => {
    if (!projectsData) return [];
    if (Array.isArray(projectsData)) return projectsData;
    return (projectsData as { data?: { id: string; name: string }[] })?.data ?? [];
  }, [projectsData]);

  const meta = useMemo(() => {
    if (!data || Array.isArray(data)) return null;
    return (data as { meta?: { total: number; page: number; limit: number; totalPages: number; totalSeconds?: number; currentMonthSeconds?: number; monthRunningCount?: number; thresholdHours?: number } })?.meta;
  }, [data]);

  // Cálculos do Tempo Total do Mês Vigente (sem filtro) com ticker em tempo real
  const baseMonthSeconds = useMemo(() => {
    if (meta?.currentMonthSeconds != null) {
      return meta.currentMonthSeconds;
    }
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
    return entries.reduce((acc, e) => {
      const entryTime = e.startTime ? new Date(e.startTime).getTime() : 0;
      if (entryTime >= startOfMonth) {
        if (e.duration != null) return acc + e.duration;
      }
      return acc;
    }, 0);
  }, [meta, entries]);

  const monthRunningCount = useMemo(() => {
    if (meta?.monthRunningCount != null) {
      return meta.monthRunningCount;
    }
    if (activeTimerData?.entry && !activeTimerData.entry.endTime) {
      return 1;
    }
    return entries.filter((e) => !e.endTime).length;
  }, [meta, activeTimerData, entries]);

  const [elapsedTick, setElapsedTick] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets ticker on subscription change
    setElapsedTick(0);
    if (monthRunningCount === 0) return;
    const interval = setInterval(() => {
      setElapsedTick((prev) => prev + monthRunningCount);
    }, 1000);
    return () => clearInterval(interval);
  }, [monthRunningCount, data]);

  const liveMonthSeconds = baseMonthSeconds + elapsedTick;

  const handleEdit = useCallback((entry: TimeEntry) => {
    setEditingEntry(entry);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setDeletingEntryId(id);
  }, []);

  const handleRestart = useCallback(
    async (entry: TimeEntry) => {
      try {
        await startTimerMutation.mutateAsync({
          description: entry.description || entry.entityTitle || undefined,
          projectId: entry.projectId || undefined,
          entityType: entry.entityType || undefined,
          entityId: entry.entityId || undefined,
          entityTitle: entry.entityTitle || undefined,
          isBillable: entry.isBillable ?? true,
        });
      } catch {
        // Erro tratado via Alive
      }
    },
    [startTimerMutation],
  );

  const handleStop = useCallback(async () => {
    try {
      await stopTimerMutation.mutateAsync();
    } catch {
      // Erro tratado via Alive
    }
  }, [stopTimerMutation]);

  const validateExportPeriod = useCallback((): boolean => {
    const startDate = filters.startDate;
    const endDate = filters.endDate;

    if (!startDate && !endDate) {
      toast.warning(t('exportPeriodUndefined'));
      return false;
    }

    if (!startDate || !endDate) {
      toast.warning(t('exportPeriodDatesRequired'));
      return false;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast.warning(t('exportPeriodDatesRequired'));
      return false;
    }

    if (start > end) {
      toast.warning(t('exportPeriodInvalid'));
      return false;
    }

    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 90) {
      toast.warning(t('exportPeriodExceeded', { days: diffDays }));
      return false;
    }

    return true;
  }, [filters.startDate, filters.endDate, t]);

  const handleExportCsv = useCallback(() => {
    if (!validateExportPeriod()) return;

    const params: Record<string, string> = {};
    if (globalFilter) params.search = globalFilter;
    if (filters.projectId) params.projectId = filters.projectId;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (Object.keys(filters).length > 0) {
      params.filter = JSON.stringify(filters);
    }

    const activeProject = projects.find((p) => p.id === filters.projectId);

    exportMutation.mutate({
      ...params,
      format: 'csv',
      projectName: activeProject?.name,
    });
  }, [validateExportPeriod, exportMutation, filters, globalFilter, projects]);

  const handleExportPdf = useCallback(() => {
    if (!validateExportPeriod()) return;

    const params: Record<string, string> = {};
    if (globalFilter) params.search = globalFilter;
    if (filters.projectId) params.projectId = filters.projectId;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (Object.keys(filters).length > 0) {
      params.filter = JSON.stringify(filters);
    }

    const activeProject = projects.find((p) => p.id === filters.projectId);

    exportMutation.mutate({
      ...params,
      format: 'pdf',
      projectName: activeProject?.name,
    });
  }, [validateExportPeriod, exportMutation, filters, globalFilter, projects]);

  const activeEntryId = activeTimerData?.entry?.id;

  const columns = useMemo(
    () =>
      getTimeTrackingColumns({
        t,
        onEdit: handleEdit,
        onDelete: handleDelete,
        onRestart: handleRestart,
        onStop: handleStop,
        activeEntryId,
      }),
    [t, handleEdit, handleDelete, handleRestart, handleStop, activeEntryId],
  );

  return (
    <div className="space-y-6">
      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">{t('totalTime')}</span>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {formatDuration(liveMonthSeconds)}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">{t('totalEntries')}</span>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {meta?.total ?? entries.length}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-muted text-muted-foreground">
            <Briefcase className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tabela Padrão DataTable com Suporte a SSR, Agrupamento e Filtros */}
      <DataTable
        columns={columns}
        data={data}
        error={error}
        isLoading={isLoading}
        queryKey={['time-tracking', queryParams]}
        pagination={pagination}
        onPaginationChange={setPagination}
        globalFilter={globalFilter}
        enableGlobalFilter={true}
        onGlobalFilterChange={setGlobalFilter}
        filters={filters}
        onFiltersChange={setFilters}
        enableGrouping={true}
        searchPlaceholder={t('searchPlaceholder')}
        emptyMessage={t('noEntries')}
        entityName={t('entity')}
        entityNamePlural={t('entityPlural')}
        getRowClassName={(row) =>
          row.original?.isForgotten
            ? 'bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-500/15 dark:hover:bg-amber-500/20 border-l-4 border-l-amber-500'
            : undefined
        }
      >
        <DataTable.Input
          title={t('searchText')}
          placeholder={t('searchPlaceholder')}
        />

        <DataTable.Select
          title={t('filterByProject')}
          accessorKey="projectId"
          placeholder={t('allProjects')}
          options={projects.map((p) => ({
            value: p.id,
            label: p.name,
          }))}
        />

        <TimeTrackerDateFilter
          filters={filters}
          onFiltersChange={setFilters}
        />

        <DataTable.Actions>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={exportMutation.isPending}
                className="h-9 gap-1.5 text-xs font-medium"
              >
                <Download className="h-4 w-4" />
                {exportMutation.isPending ? t('exporting') : t('exportReport')}
                <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onSelect={handleExportPdf}
                disabled={exportMutation.isPending}
                className="gap-2 cursor-pointer font-medium text-xs py-2"
              >
                <FileText className="h-4 w-4 text-rose-500" />
                {t('exportPdf')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleExportCsv}
                disabled={exportMutation.isPending}
                className="gap-2 cursor-pointer font-medium text-xs py-2"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                {t('exportCsv')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsManualModalOpen(true)}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <PlusCircle className="h-4 w-4" />
            {t('manual_entry')}
          </Button>

          <Button
            size="sm"
            onClick={() => setIsStartModalOpen(true)}
            className="h-9 gap-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Play className="h-4 w-4 fill-white" />
            {t('start')}
          </Button>
        </DataTable.Actions>
      </DataTable>

      {/* Modais de Ação */}
      <StartTimerModal open={isStartModalOpen} onOpenChange={setIsStartModalOpen} />
      <ManualEntryDialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen} />
      <EditTimeEntryDialog
        entry={editingEntry}
        open={!!editingEntry}
        onOpenChange={(open) => !open && setEditingEntry(null)}
      />
      <ConfirmDialog
        open={!!deletingEntryId}
        onOpenChange={(open) => !open && setDeletingEntryId(null)}
        title={t('deleteEntry')}
        description={t('confirmDelete')}
        confirmVariant="destructive"
        onConfirm={async () => {
          if (!deletingEntryId) return;
          try {
            await deleteMutation.mutateAsync(deletingEntryId);
          } catch {
            // Erro tratado via Alive
          }
          setDeletingEntryId(null);
        }}
      />
    </div>
  );
}
