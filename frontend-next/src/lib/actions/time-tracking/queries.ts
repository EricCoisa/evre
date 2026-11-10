"use client";

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/lib/types/pagination.types';
import { useTranslation } from '@/hooks/use-translation';
import {
  getActiveTimer,
  startTimer,
  stopTimer,
  createManualTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  listTimeEntries,
  exportTimeEntries,
} from './api';
import { Collector, Alive } from '@/lib/api/collector';
import { toast } from 'sonner';
import type {
  StartTimerDto,
  UpdateTimeEntryDto,
  CreateManualEntryDto,
  TimeTrackingControllerListTimeEntriesParams,
  TimeTrackingControllerExportTimeEntriesParams,
  TimeEntry,
} from './types';

const TIME_TRACKING_CHANNEL = 'evre_time_tracking_bus';

function notifyChannel(entry: Partial<TimeEntry> & { id: string }) {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    const channel = new BroadcastChannel(TIME_TRACKING_CHANNEL);
    channel.postMessage({ type: 'TIMER_CHANGED', entry });
    channel.close();
  }
}

function updateListCacheOnStart(queryClient: QueryClient, newEntry: TimeEntry) {
  queryClient.setQueriesData<PaginatedResponse<TimeEntry> | TimeEntry[]>(
    { queryKey: ['time-tracking', 'list'] },
    (old) => {
      if (!old) return old;
      const items = Array.isArray(old) ? old : old.data;
      if (!Array.isArray(items)) return old;

      // Se havia algum timer rodando sem endTime (switch automático), encerra-o
      const updatedItems = items.map((item: TimeEntry) => {
        if (!item.endTime && item.id !== newEntry.id) {
          const duration = Math.max(
            0,
            Math.round(
              (new Date(newEntry.startTime).getTime() - new Date(item.startTime).getTime()) / 1000,
            ),
          );
          return { ...item, endTime: newEntry.startTime, duration };
        }
        return item;
      });

      const alreadyExists = updatedItems.some((i: TimeEntry) => i.id === newEntry.id);
      const finalItems = alreadyExists ? updatedItems : [newEntry, ...updatedItems];

      if (Array.isArray(old)) return finalItems;
      return {
        ...old,
        data: finalItems,
        meta: { ...old.meta, total: old.meta.total + (alreadyExists ? 0 : 1) },
      };
    },
  );
}

function updateListCacheOnStop(queryClient: QueryClient, stoppedEntry: TimeEntry) {
  queryClient.setQueriesData<PaginatedResponse<TimeEntry> | TimeEntry[]>(
    { queryKey: ['time-tracking', 'list'] },
    (old) => {
      if (!old) return old;
      const items = Array.isArray(old) ? old : old.data;
      if (!Array.isArray(items)) return old;

      const finalItems = items.map((item: TimeEntry) => {
        if (item.id === stoppedEntry.id) {
          return {
            ...item,
            endTime: stoppedEntry.endTime,
            duration: stoppedEntry.duration,
          };
        }
        return item;
      });

      if (Array.isArray(old)) return finalItems;
      return { ...old, data: finalItems };
    },
  );
}

function invalidateTimeTracking(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['time-tracking'], refetchType: 'all' });
}

export function useActiveTimer(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['time-tracking', 'active'],
    queryFn: Collector(() => getActiveTimer(), { silentStatuses: [404] }),
    staleTime: 1000 * 5,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    retry: 1,
    enabled: options?.enabled ?? true,
  });

  // Sincronização em tempo real entre abas sem polling (BroadcastChannel)
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    const channel = new BroadcastChannel(TIME_TRACKING_CHANNEL);
    channel.onmessage = (event) => {
      if (event.data?.type === 'TIMER_CHANGED') {
        const entry = event.data?.entry;
        if (entry && !entry.endTime && entry.id !== 'mutation_sync') {
          queryClient.setQueryData(['time-tracking', 'active'], {
            entry,
            isForgotten: false,
            thresholdHours: 8,
          });
          updateListCacheOnStart(queryClient, entry);
        } else if (entry?.endTime) {
          queryClient.setQueryData(['time-tracking', 'active'], {
            entry: null,
            isForgotten: false,
            thresholdHours: 8,
          });
          updateListCacheOnStop(queryClient, entry);
        }
        invalidateTimeTracking(queryClient);
      }
    };

    return () => {
      channel.close();
    };
  }, [queryClient]);

  return query;
}

export function useStartTimer() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('time-tracking');

  return useMutation({
    mutationFn: (data: StartTimerDto) => Alive(() => startTimer(data))(),
    onSuccess: (newEntry) => {
      queryClient.setQueryData(['time-tracking', 'active'], {
        entry: newEntry,
        isForgotten: false,
        thresholdHours: 8,
      });
      updateListCacheOnStart(queryClient, newEntry);
      invalidateTimeTracking(queryClient);
      notifyChannel(newEntry);

      toast.success(
        newEntry?.description
          ? `${t('startSuccess')} "${newEntry.description}"`
          : t('startSuccess'),
      );
    },
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('time-tracking');

  return useMutation({
    mutationFn: () => Alive(() => stopTimer())(),
    onSuccess: (stoppedEntry) => {
      queryClient.setQueryData(['time-tracking', 'active'], {
        entry: null,
        isForgotten: false,
        thresholdHours: 8,
      });
      updateListCacheOnStop(queryClient, stoppedEntry);
      invalidateTimeTracking(queryClient);
      notifyChannel(stoppedEntry);

      toast.success(t('stopSuccess'));
    },
  });
}

export function useCreateManualEntry() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('time-tracking');

  return useMutation({
    mutationFn: (data: CreateManualEntryDto) =>
      Alive(() => createManualTimeEntry(data))(),
    onSuccess: () => {
      invalidateTimeTracking(queryClient);
      notifyChannel({ id: 'mutation_sync' });
      toast.success(t('createManualSuccess'));
    },
  });
}

export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('time-tracking');

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTimeEntryDto }) =>
      Alive(() => updateTimeEntry(id, data))(),
    onSuccess: () => {
      invalidateTimeTracking(queryClient);
      notifyChannel({ id: 'mutation_sync' });
      toast.success(t('updateSuccess'));
    },
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('time-tracking');

  return useMutation({
    mutationFn: (id: string) => Alive(() => deleteTimeEntry(id))(),
    onSuccess: () => {
      invalidateTimeTracking(queryClient);
      notifyChannel({ id: 'mutation_sync' });
      toast.success(t('deleteSuccess'));
    },
  });
}

export function useTimeEntries(params?: TimeTrackingControllerListTimeEntriesParams) {
  return useQuery({
    queryKey: ['time-tracking', 'list', params],
    queryFn: Collector(() => listTimeEntries(params)),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

export function useExportTimeEntries() {
  const { t } = useTranslation('time-tracking');

  return useMutation({
    mutationFn: async (variables?: {
      format?: 'csv' | 'pdf';
      projectName?: string;
      userName?: string;
      [key: string]: unknown;
    }) => {
      const { format = 'csv', projectName, userName, ...params } = variables || {};

      if (format === 'pdf') {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => v != null && searchParams.set(k, String(v)));
        const response = await fetch(`/api/time-tracking/export/pdf?${searchParams}`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('export_pdf_failed');
        const blob = await response.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'relatorio-tempo.pdf';
        a.click();
        URL.revokeObjectURL(a.href);
        return { data: null, format: 'pdf' as const, projectName, userName };
      }

      const data = await Alive(() => exportTimeEntries(params as TimeTrackingControllerExportTimeEntriesParams))();
      return { data, format: 'csv' as const, projectName, userName };
    },
    onSuccess: async ({ data, format }) => {
      if (format === 'pdf') {
        toast.success(t('exportPdfSuccess'));
        return;
      }
      if (!data) return;
      if (data.csv) {
        const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', data.filename || 'relatorio-tempo.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(t('exportSuccess'));
      }
    },
    onError: () => {
      toast.error(t('exportError'));
    },
  });
}
