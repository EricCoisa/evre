'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Play, Square, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useActiveTimer, useStopTimer } from '@/lib/actions/time-tracking/queries';
import { StartTimerModal } from './start-timer-modal';
import { useTranslation } from '@/hooks/use-translation';

function resolveActiveTimerView(activeTimerData: ReturnType<typeof useActiveTimer>['data']) {
  return {
    entry: activeTimerData?.entry,
    isForgotten: activeTimerData?.isForgotten ?? false,
    thresholdHours: activeTimerData?.thresholdHours ?? 8,
  };
}

function resolveDisplayTitle(
  entry: { entityTitle?: string | null; description?: string | null },
  t: (key: string) => string,
): string {
  return entry.entityTitle || entry.description || t('session');
}

function TimerErrorState({ onRetry, t }: { onRetry: () => void; t: (key: string) => string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Clock className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{t('start')}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function TimerStartButton({ onOpen, t }: { onOpen: () => void; t: (key: string) => string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpen}
          className="h-8 gap-1.5 border-dashed border-emerald-500/50 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 text-xs font-medium"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>{t('start')}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{t('startTimerDescription')}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function ActiveTimerIndicator({
  isForgotten,
  elapsedSeconds,
  thresholdHours,
  t,
}: {
  isForgotten: boolean;
  elapsedSeconds: number;
  thresholdHours: number;
  t: (key: string) => string;
}) {
  if (isForgotten) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-help">
            <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
              {formatElapsed(elapsedSeconds)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-semibold text-amber-600 dark:text-amber-400">{t('forgotten_alert')}</p>
          <p className="text-xs">
            {t('forgotten_description')} ({thresholdHours}h)
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span className="font-mono font-bold text-foreground">{formatElapsed(elapsedSeconds)}</span>
    </div>
  );
}

function ActiveTimerLabel({
  displayTitle,
  projectName,
}: {
  displayTitle: string;
  projectName: string | undefined;
}) {
  return (
    <div className="hidden sm:flex items-center gap-1 max-w-[140px] md:max-w-[200px] truncate">
      <Link href="/time-tracker" className="truncate font-medium hover:underline text-[11px]" title={displayTitle}>
        {displayTitle}
      </Link>
      {projectName && (
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-muted-foreground/30 truncate max-w-[80px]">
          {projectName}
        </Badge>
      )}
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [
    h.toString().padStart(2, '0'),
    m.toString().padStart(2, '0'),
    s.toString().padStart(2, '0'),
  ].join(':');
}

export function HeaderTimeTracker() {
  const { t } = useTranslation('time-tracking');
  const { data: activeTimerData, isLoading, isError, refetch } = useActiveTimer();
  const stopTimerMutation = useStopTimer();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const entry = activeTimerData?.entry;
  const startTime = entry?.startTime ?? null;
  const elapsedSeconds = useSyncExternalStore(
    (onChange) => {
      if (!startTime) return () => {};
      const interval = setInterval(onChange, 1000);
      return () => clearInterval(interval);
    },
    () => startTime
      ? Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 1000))
      : 0,
    () => 0,
  );
  const { isForgotten, thresholdHours } = resolveActiveTimerView(activeTimerData);

  const handleStop = async () => {
    try {
      await stopTimerMutation.mutateAsync();
    } catch {
      // Erro tratado via Alive
    }
  };

  if (isLoading) {
    return (
      <div className="h-8 w-24 rounded-md bg-muted/30 animate-pulse" />
    );
  }

  // Estado em erro com retry manual
  if (isError && !entry) {
    return <TimerErrorState onRetry={() => refetch()} t={t} />;
  }

  // Estado 1: Timer Inativo — botão Start
  if (!entry) {
    return (
      <>
        <TimerStartButton onOpen={() => setIsModalOpen(true)} t={t} />
        <StartTimerModal open={isModalOpen} onOpenChange={setIsModalOpen} />
      </>
    );
  }

  // Estado 2: Timer Ativo rodando
  const displayTitle = resolveDisplayTitle(entry, t);

  return (
    <>
      <div
        className={`flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs transition-colors ${
          isForgotten
            ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
        }`}
      >
        <ActiveTimerIndicator
          isForgotten={isForgotten}
          elapsedSeconds={elapsedSeconds}
          thresholdHours={thresholdHours}
          t={t}
        />

        <ActiveTimerLabel displayTitle={displayTitle} projectName={entry.project?.name} />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleStop}
              disabled={stopTimerMutation.isPending}
              className="h-6 w-6 text-destructive hover:bg-destructive/15 hover:text-destructive rounded-sm p-0 ml-1"
            >
              <Square className="h-3 w-3 fill-current" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t('stop')}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <StartTimerModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </>
  );
}
