'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@/hooks/use-translation';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import {
  useTimeEntries,
  useDeleteTimeEntry,
  useStartTimer,
  useStopTimer,
  useActiveTimer,
} from '@/lib/actions/time-tracking/queries';
import { useProjects } from '@/lib/actions/project/queries';
import { getTimeTrackingColumns, formatDuration } from './time-tracker-columns';
import { StartTimerModal } from '@/components/time-tracking/start-timer-modal';
import { EditTimeEntryDialog } from './edit-time-entry-dialog';
import { ManualEntryDialog } from './manual-entry-dialog';
import type { TimeEntry } from '@/lib/actions/time-tracking/types';
import { buildTableQueryParams } from '@/lib/table-query-params';
import { toast } from 'sonner';
import {
  Play,
  PlusCircle,
  Clock,
  Briefcase,
} from 'lucide-react';

export function TimeTrackerTab() {
  const { t } = useTranslation('time-tracking');
  const queryClient = useQueryClient();

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  const { data: activeTimerData } = useActiveTimer();
  const startTimerMutation = useStartTimer();
  const stopTimerMutation = useStopTimer();
  const deleteMutation = useDeleteTimeEntry();

  // Multi-aba: escuta bus de eventos em tempo real
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel('evre_time_tracking_bus');
    channel.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'], refetchType: 'all' });
    };
    return () => {
      channel.close();
    };
  }, [queryClient]);

  const queryParams = buildTableQueryParams(pagination, globalFilter, filters);
  const { data, error, isLoading } = useTimeEntries(queryParams as any);
  const { data: projectsData } = useProjects({ limit: 50 });

  const entries: TimeEntry[] = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return (data as { data?: TimeEntry[] })?.data ?? (data as { items?: TimeEntry[] })?.items ?? [];
  }, [data]);

  const projects = useMemo(() => {
    if (!projectsData) return [];
    if (Array.isArray(projectsData)) return projectsData;
    return (projectsData as { data?: any[] })?.data ?? [];
  }, [projectsData]);

  const meta = useMemo(() => {
    if (!data || Array.isArray(data)) return null;
    return (data as any)?.meta;
  }, [data]);

  // Cálculos de métricas do período filtrado com agregação total e ticker em tempo real
  const baseTotalSeconds = useMemo(() => {
    if (meta?.totalSeconds != null) {
      return meta.totalSeconds;
    }
    return entries.reduce((acc, e) => {
      if (e.duration != null) return acc + e.duration;
      if (!e.endTime && e.startTime) {
        return acc + Math.max(0, Math.floor((Date.now() - new Date(e.startTime).getTime()) / 1000));
      }
      return acc;
    }, 0);
  }, [meta, entries]);

  const runningCount = useMemo(() => {
    return entries.filter((e) => !e.endTime).length;
  }, [entries]);

  const [elapsedTick, setElapsedTick] = useState(0);

  useEffect(() => {
    setElapsedTick(0);
    if (runningCount === 0) return;
    const interval = setInterval(() => {
      setElapsedTick((prev) => prev + runningCount);
    }, 1000);
    return () => clearInterval(interval);
  }, [runningCount, data]);

  const liveTotalSeconds = baseTotalSeconds + elapsedTick;

  const handleEdit = useCallback((entry: TimeEntry) => {
    setEditingEntry(entry);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (confirm(t('confirmDelete'))) {
        try {
          await deleteMutation.mutateAsync(id);
        } catch {
          // Erro tratado via Alive
        }
      }
    },
    [deleteMutation, t],
  );

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
      } catch (err) {
        console.error('[TimeTrackerTab] Erro ao reiniciar timer:', err);
      }
    },
    [startTimerMutation],
  );

  const handleStop = useCallback(async () => {
    try {
      await stopTimerMutation.mutateAsync();
    } catch (err) {
      console.error('[TimeTrackerTab] Erro ao parar timer:', err);
    }
  }, [stopTimerMutation]);

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
              {formatDuration(liveTotalSeconds)}
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
        data={data as any}
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
      >
        <DataTable.Input
          title={t('searchText')}
          placeholder={t('searchPlaceholder')}
        />

        <DataTable.Select
          title={t('filterByProject')}
          accessorKey="projectId"
          placeholder={t('allProjects')}
          options={projects.map((p: any) => ({
            value: p.id,
            label: p.name,
          }))}
        />

        <DataTable.Actions>
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
    </div>
  );
}
