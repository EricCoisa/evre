'use client';

import { useState, useEffect } from 'react';
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
  const { data: activeTimerData, isLoading } = useActiveTimer();
  const stopTimerMutation = useStopTimer();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const entry = activeTimerData?.entry;
  const isForgotten = activeTimerData?.isForgotten ?? false;
  const thresholdHours = activeTimerData?.thresholdHours ?? 8;

  // Cronômetro dinâmico com tick a cada 1 segundo
  useEffect(() => {
    if (!entry?.startTime) {
      setElapsedSeconds(0);
      return;
    }

    const calcElapsed = () => {
      const startMs = new Date(entry.startTime).getTime();
      const nowMs = Date.now();
      return Math.max(0, Math.floor((nowMs - startMs) / 1000));
    };

    setElapsedSeconds(calcElapsed());
    const interval = setInterval(() => {
      setElapsedSeconds(calcElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [entry?.startTime]);

  const handleStop = async () => {
    try {
      await stopTimerMutation.mutateAsync();
    } catch {
      // Erro tratado via Alive
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 animate-pulse text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>{t('running')}</span>
      </div>
    );
  }

  // Estado 1: Timer Inativo — botão Start
  if (!entry) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(true)}
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

        <StartTimerModal open={isModalOpen} onOpenChange={setIsModalOpen} />
      </>
    );
  }

  // Estado 2: Timer Ativo rodando
  const displayTitle =
    entry.entityTitle || entry.description || t('running');

  return (
    <>
      <div
        className={`flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs transition-colors ${
          isForgotten
            ? 'bg-destructive/10 border-destructive/40 text-destructive'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
        }`}
      >
        {isForgotten ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" />
                <span className="font-mono font-bold text-destructive">
                  {formatElapsed(elapsedSeconds)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="font-semibold text-destructive">{t('forgotten_alert')}</p>
              <p className="text-xs">
                {t('forgotten_description')} ({thresholdHours}h)
              </p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono font-bold text-foreground">
              {formatElapsed(elapsedSeconds)}
            </span>
          </div>
        )}

        <div className="hidden sm:flex items-center gap-1 max-w-[140px] md:max-w-[200px] truncate">
          <Link
            href="/time-tracker"
            className="truncate font-medium hover:underline text-[11px]"
            title={displayTitle}
          >
            {displayTitle}
          </Link>
          {entry.project && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 h-4 border-muted-foreground/30 truncate max-w-[80px]"
            >
              {entry.project.name}
            </Badge>
          )}
        </div>

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
