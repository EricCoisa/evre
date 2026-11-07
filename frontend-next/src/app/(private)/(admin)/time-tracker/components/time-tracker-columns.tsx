'use client';

import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { TimeEntry } from '@/lib/actions/time-tracking/types';
import { TableHead, DataCell } from '@/components/table-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Play,
  Square,
  Edit2,
  Trash2,
  AlertTriangle,
  FileEdit,
  DollarSign,
  User as UserIcon,
  Layers,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatDuration(seconds?: number | null): string {
  if (seconds == null || seconds < 0) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  }
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

interface GetTimeTrackingColumnsProps {
  t: (key: string) => string;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (id: string) => void;
  onRestart: (entry: TimeEntry) => void;
  onStop: () => void;
  activeEntryId?: string | null;
}

export function getTimeTrackingColumns({
  t,
  onEdit,
  onDelete,
  onRestart,
  onStop,
  activeEntryId,
}: GetTimeTrackingColumnsProps): ColumnDef<TimeEntry>[] {
  return [
    {
      id: 'activityGroup',
      accessorFn: (row) =>
        row.entityId
          ? `${row.entityType || 'TASK'}:${row.entityId}`
          : (row.description || t('noDescription')).trim().toLowerCase(),
      header: () => <TableHead>{t('activity_link')}</TableHead>,
      meta: {
        groupBy: true,
        groupLabel: (value: unknown, groupData: any) => {
          const subRows: any[] = groupData?.allSubRows ?? [];
          const count = subRows.length;
          const firstEntry = (subRows[0]?.original || {}) as TimeEntry;
          const totalDuration = subRows.reduce(
            (acc: number, r: any) => acc + (r.original?.duration ?? 0),
            0,
          );
          const hasRunning =
            subRows.some((r: any) => !r.original?.endTime) ||
            (activeEntryId ? subRows.some((r: any) => r.original?.id === activeEntryId) : false);
          const hasForgotten = subRows.some((r: any) => r.original?.isForgotten);
          const title = firstEntry?.description || firstEntry?.entityTitle || t('noDescription');

          return (
            <div className="flex items-center justify-between w-full pr-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-sm">{title}</span>
                {firstEntry?.entityType && (
                  <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                    {firstEntry.entityType}
                  </Badge>
                )}
                {firstEntry?.project?.name && (
                  <Badge variant="secondary" className="text-[10px]">
                    {firstEntry.project.name}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] gap-1 px-1.5 bg-background/80"
                >
                  <Layers className="h-3 w-3 text-muted-foreground" />
                  {count} {t('stackedSessions')}
                </Badge>
                {hasForgotten && (
                  <Badge variant="destructive" className="text-[10px] gap-1 px-1.5">
                    <AlertTriangle className="h-3 w-3" />
                    {t('forgotten_alert')}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3">
                {hasRunning && (
                  <Badge className="bg-emerald-500 text-white animate-pulse text-[9px] px-1.5">
                    {t('running')}
                  </Badge>
                )}
                <span className="font-mono font-bold text-foreground text-xs">
                  {formatDuration(totalDuration)}
                </span>
                {hasRunning ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/15 dark:hover:bg-destructive/25"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStop();
                    }}
                    title={t('stopTaskTimer')}
                  >
                    <Square className="h-3.5 w-3.5 fill-current animate-pulse" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (firstEntry) onRestart(firstEntry);
                    }}
                    title={t('restartTask')}
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                  </Button>
                )}
              </div>
            </div>
          );
        },
      },
      cell: ({ row }) => {
        const entry = row.original;
        return (
          <DataCell>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-foreground">
                {entry.description || entry.entityTitle || t('noDescription')}
              </span>
              {entry.entityType && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="font-medium px-1 py-0.2 rounded bg-muted">
                    {entry.entityType}
                  </span>
                  {entry.entityTitle && (
                    <span className="truncate max-w-[240px]">{entry.entityTitle}</span>
                  )}
                </div>
              )}
            </div>
          </DataCell>
        );
      },
    },
    {
      id: 'dateTime',
      accessorFn: (row) => row.startTime,
      header: () => <TableHead>{t('date_time')}</TableHead>,
      cell: ({ row }) => {
        const entry = row.original;
        const formattedDate = format(new Date(entry.startTime), 'dd/MM/yyyy', { locale: ptBR });
        const startTimeStr = format(new Date(entry.startTime), 'HH:mm');
        const endTimeStr = entry.endTime ? format(new Date(entry.endTime), 'HH:mm') : t('running');

        return (
          <DataCell>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">{formattedDate}</span>
              <span className="text-[11px] text-muted-foreground font-mono">
                {startTimeStr} - {endTimeStr}
              </span>
            </div>
          </DataCell>
        );
      },
    },
    {
      id: 'project',
      accessorFn: (row) => row.project?.name || t('standalone'),
      header: () => <TableHead>{t('project')}</TableHead>,
      cell: ({ row }) => {
        const entry = row.original;
        return (
          <DataCell>
            {entry.project ? (
              <Badge variant="outline" className="text-[10px] font-normal truncate max-w-[140px]">
                {entry.project.name}
              </Badge>
            ) : (
              <span className="text-[11px] text-muted-foreground italic">{t('standalone')}</span>
            )}
          </DataCell>
        );
      },
    },
    {
      id: 'operator',
      accessorFn: (row) => row.user?.name || row.user?.email || t('operator'),
      header: () => <TableHead>{t('operator')}</TableHead>,
      cell: ({ row }) => {
        const entry = row.original;
        return (
          <DataCell>
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <UserIcon className="h-3.5 w-3.5" />
              <span className="truncate max-w-[100px]">
                {entry.user?.name || entry.user?.email || t('operator')}
              </span>
            </div>
          </DataCell>
        );
      },
    },
    {
      id: 'duration',
      accessorKey: 'duration',
      header: () => <TableHead className="text-right">{t('duration')}</TableHead>,
      cell: ({ row }) => {
        const entry = row.original;
        const isRunning = !entry.endTime;

        return (
          <DataCell className="text-right">
            {isRunning ? (
              <Badge className="bg-emerald-500 text-white animate-pulse text-[10px]">
                {t('running')}
              </Badge>
            ) : (
              <span className="font-mono text-xs font-bold text-foreground">
                {formatDuration(entry.duration)}
              </span>
            )}
          </DataCell>
        );
      },
    },
    {
      id: 'audit',
      header: () => <TableHead className="text-center">{t('audit')}</TableHead>,
      cell: ({ row }) => {
        const entry = row.original;

        return (
          <DataCell className="text-center">
            <div className="flex items-center justify-center gap-1">
              {entry.isForgotten && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-1 rounded bg-destructive/15 text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs font-semibold text-destructive">{t('forgotten_alert')}</p>
                    <p className="text-[11px]">{t('forgotten_description')}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {entry.isManual && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 gap-0.5">
                      <FileEdit className="h-2.5 w-2.5" />
                      {t('manual_badge')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">
                      {t('manual_audit')}
                      {entry.editedBy?.name ? ` por ${entry.editedBy.name}` : ''}.
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}

              {entry.isBillable && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-0.5 rounded text-emerald-600 dark:text-emerald-400">
                      <DollarSign className="h-3 w-3" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">{t('billable')}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </DataCell>
        );
      },
    },
    {
      id: 'actions',
      header: () => <TableHead className="text-right">{t('actions')}</TableHead>,
      meta: { isAction: true },
      cell: ({ row }) => {
        const entry = row.original;
        const isRunning = !entry.endTime || (activeEntryId ? entry.id === activeEntryId : false);

        return (
          <DataCell className="text-right">
            <div className="flex items-center justify-end gap-1">
              {isRunning ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/15 dark:hover:bg-destructive/25"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStop();
                  }}
                  title={t('stopTaskTimer')}
                >
                  <Square className="h-3.5 w-3.5 fill-current animate-pulse" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestart(entry);
                  }}
                  title={t('restartTask')}
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(entry);
                }}
                title={t('editEntry')}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(entry.id);
                }}
                title={t('deleteEntry')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </DataCell>
        );
      },
    },
  ];
}
