'use client';

import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, Clock, Loader2, Ban } from 'lucide-react';
import type { MilestoneTask, ProjectTaskStatus } from '@/lib/actions/project/types';

export interface MilestoneProgressStats {
  total: number;
  activeCount: number;
  waitingCount: number;
  inProgressCount: number;
  blockedCount: number;
  doneCount: number;
  cancelledCount: number;
  percentage: number;
}

export function calculateMilestoneProgress(tasks: MilestoneTask[] = []): MilestoneProgressStats {
  const total = tasks.length;
  const waitingCount = tasks.filter((t) => t.status === 'WAITING' || !t.status).length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const blockedCount = tasks.filter((t) => t.status === 'BLOCKED').length;
  const doneCount = tasks.filter((t) => t.status === 'DONE').length;
  const cancelledCount = tasks.filter((t) => t.status === 'CANCELLED').length;

  const activeCount = total - cancelledCount;

  if (activeCount <= 0) {
    return {
      total,
      activeCount: 0,
      waitingCount,
      inProgressCount,
      blockedCount,
      doneCount,
      cancelledCount,
      percentage: 0,
    };
  }

  const weightedSum = doneCount * 1.0 + inProgressCount * 0.5;
  const rawPercentage = (weightedSum / activeCount) * 100;
  const percentage = doneCount === activeCount ? 100 : Math.min(99, Math.round(rawPercentage));

  return {
    total,
    activeCount,
    waitingCount,
    inProgressCount,
    blockedCount,
    doneCount,
    cancelledCount,
    percentage,
  };
}

export const TASK_STATUS_CONFIG: Record<
  ProjectTaskStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  WAITING: {
    label: 'Aguardando',
    variant: 'outline',
    className: 'bg-muted/50 text-muted-foreground border-border hover:bg-muted',
    icon: Clock,
  },
  IN_PROGRESS: {
    label: 'Em Progresso',
    variant: 'outline',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/20',
    icon: Loader2,
  },
  BLOCKED: {
    label: 'Bloqueado',
    variant: 'destructive',
    className: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/25',
    icon: AlertTriangle,
  },
  DONE: {
    label: 'Concluído',
    variant: 'outline',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20',
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: 'Cancelado',
    variant: 'secondary',
    className: 'bg-muted/40 text-muted-foreground/70 line-through border-transparent hover:bg-muted/60',
    icon: Ban,
  },
};

interface MilestoneProgressBarProps {
  tasks: MilestoneTask[];
  compact?: boolean;
}

export function MilestoneProgressBar({ tasks, compact = false }: MilestoneProgressBarProps) {
  const stats = calculateMilestoneProgress(tasks);

  if (compact) {
    return (
      <div className="space-y-1.5 w-full">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground font-medium">
            Progresso da Etapa
          </span>
          <div className="flex items-center gap-1.5 font-semibold">
            {stats.blockedCount > 0 && (
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-normal">
                ({stats.blockedCount} bloqueada{stats.blockedCount > 1 ? 's' : ''})
              </span>
            )}
            <span
              className={
                stats.percentage === 100
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-foreground'
              }
            >
              {stats.percentage}%
            </span>
          </div>
        </div>
        <Progress
          value={stats.percentage}
          className="h-1.5 bg-muted/60"
          indicatorClassName={
            stats.percentage === 100
              ? 'bg-emerald-500'
              : stats.blockedCount > 0
              ? 'bg-amber-500'
              : 'bg-primary'
          }
        />
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg border bg-card/60 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          {stats.percentage === 100 ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <span className="text-muted-foreground text-[11px]">Progresso</span>
          )}
          <span>{stats.percentage}% concluído</span>
        </div>

        <span className="text-[11px] text-muted-foreground">
          {stats.doneCount} de {stats.activeCount} tarefas
        </span>
      </div>

      <Progress
        value={stats.percentage}
        className="h-2"
        indicatorClassName={
          stats.percentage === 100
            ? 'bg-emerald-500'
            : stats.blockedCount > 0
            ? 'bg-amber-500'
            : 'bg-primary'
        }
      />

      <div className="flex items-center gap-2 pt-0.5 text-[10px] text-muted-foreground flex-wrap">
        {stats.doneCount > 0 && (
          <span className="text-emerald-700 dark:text-emerald-300 font-medium">
            {stats.doneCount} concluída{stats.doneCount > 1 ? 's' : ''}
          </span>
        )}
        {stats.inProgressCount > 0 && (
          <span className="text-blue-700 dark:text-blue-300 font-medium">
            {stats.inProgressCount} em progresso
          </span>
        )}
        {stats.waitingCount > 0 && (
          <span>
            {stats.waitingCount} aguardando
          </span>
        )}
        {stats.blockedCount > 0 && (
          <Badge variant="destructive" className="h-4 text-[9px] px-1.5 py-0 gap-1">
            <AlertTriangle className="h-2.5 w-2.5" />
            {stats.blockedCount} bloqueada{stats.blockedCount > 1 ? 's' : ''}
          </Badge>
        )}
        {stats.cancelledCount > 0 && (
          <span className="line-through text-muted-foreground/60">
            {stats.cancelledCount} cancelada{stats.cancelledCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

