'use client';

import React, { useMemo, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface TimeTrackerDateFilterProps {
  filters: Record<string, string>;
  onFiltersChange: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  className?: string;
}

export type DatePresetKey =
  | 'all'
  | 'current_month'
  | 'previous_month'
  | 'today'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'custom';

export function TimeTrackerDateFilter({
  filters,
  onFiltersChange,
  className,
}: TimeTrackerDateFilterProps) {
  const { t } = useTranslation('time-tracking');

  const startDateIso = filters.startDate;
  const endDateIso = filters.endDate;

  // Calcula valores de referência
  const presetBounds = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curDate = now.getDate();

    // Mês atual: dia 1 00:00:00 ao último dia 23:59:59
    const curMonthStart = new Date(curYear, curMonth, 1, 0, 0, 0, 0).toISOString();
    const curMonthEnd = new Date(curYear, curMonth + 1, 0, 23, 59, 59, 999).toISOString();

    // Mês anterior: dia 1 00:00:00 ao último dia 23:59:59 do mês anterior
    const prevMonthStart = new Date(curYear, curMonth - 1, 1, 0, 0, 0, 0).toISOString();
    const prevMonthEnd = new Date(curYear, curMonth, 0, 23, 59, 59, 999).toISOString();

    // Hoje
    const todayStart = new Date(curYear, curMonth, curDate, 0, 0, 0, 0).toISOString();
    const todayEnd = new Date(curYear, curMonth, curDate, 23, 59, 59, 999).toISOString();

    // Últimos 7 dias
    const last7Start = new Date(curYear, curMonth, curDate - 7, 0, 0, 0, 0).toISOString();
    const last7End = new Date(curYear, curMonth, curDate, 23, 59, 59, 999).toISOString();

    // Últimos 30 dias
    const last30Start = new Date(curYear, curMonth, curDate - 30, 0, 0, 0, 0).toISOString();
    const last30End = new Date(curYear, curMonth, curDate, 23, 59, 59, 999).toISOString();

    // Últimos 90 dias
    const last90Start = new Date(curYear, curMonth, curDate - 90, 0, 0, 0, 0).toISOString();
    const last90End = new Date(curYear, curMonth, curDate, 23, 59, 59, 999).toISOString();

    return {
      current_month: { start: curMonthStart, end: curMonthEnd },
      previous_month: { start: prevMonthStart, end: prevMonthEnd },
      today: { start: todayStart, end: todayEnd },
      last_7_days: { start: last7Start, end: last7End },
      last_30_days: { start: last30Start, end: last30End },
      last_90_days: { start: last90Start, end: last90End },
    };
  }, []);

  // Determina preset ativo baseado nos filtros atuais
  const activePreset: DatePresetKey = useMemo(() => {
    if (!startDateIso && !endDateIso) return 'all';

    const isSameDayRange = (s1?: string, s2?: string) => {
      if (!s1 || !s2) return false;
      return s1.slice(0, 10) === s2.slice(0, 10);
    };

    if (
      isSameDayRange(startDateIso, presetBounds.current_month.start) &&
      isSameDayRange(endDateIso, presetBounds.current_month.end)
    ) {
      return 'current_month';
    }

    if (
      isSameDayRange(startDateIso, presetBounds.previous_month.start) &&
      isSameDayRange(endDateIso, presetBounds.previous_month.end)
    ) {
      return 'previous_month';
    }

    if (
      isSameDayRange(startDateIso, presetBounds.today.start) &&
      isSameDayRange(endDateIso, presetBounds.today.end)
    ) {
      return 'today';
    }

    if (
      isSameDayRange(startDateIso, presetBounds.last_7_days.start) &&
      isSameDayRange(endDateIso, presetBounds.last_7_days.end)
    ) {
      return 'last_7_days';
    }

    if (
      isSameDayRange(startDateIso, presetBounds.last_30_days.start) &&
      isSameDayRange(endDateIso, presetBounds.last_30_days.end)
    ) {
      return 'last_30_days';
    }

    if (
      isSameDayRange(startDateIso, presetBounds.last_90_days.start) &&
      isSameDayRange(endDateIso, presetBounds.last_90_days.end)
    ) {
      return 'last_90_days';
    }

    return 'custom';
  }, [startDateIso, endDateIso, presetBounds]);

  const applyPreset = useCallback(
    (presetKey: DatePresetKey) => {
      onFiltersChange((prev) => {
        const next = { ...prev };
        if (presetKey === 'all') {
          delete next.startDate;
          delete next.endDate;
          delete next.periodPreset;
          return next;
        }

        if (presetKey === 'custom') {
          next.periodPreset = 'custom';
          return next;
        }

        const bounds = presetBounds[presetKey as keyof typeof presetBounds];
        if (bounds) {
          next.startDate = bounds.start;
          next.endDate = bounds.end;
          next.periodPreset = presetKey;
        }
        return next;
      });
    },
    [onFiltersChange, presetBounds],
  );

  // Converte ISO em formato YYYY-MM-DD para o input HTML
  const startInputVal = useMemo(() => {
    if (!startDateIso) return '';
    const d = new Date(startDateIso);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, [startDateIso]);

  const endInputVal = useMemo(() => {
    if (!endDateIso) return '';
    const d = new Date(endDateIso);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, [endDateIso]);

  const handleCustomStartChange = (val: string) => {
    onFiltersChange((prev) => {
      const next = { ...prev };
      if (!val) {
        delete next.startDate;
      } else {
        const [y, m, d] = val.split('-').map(Number);
        next.startDate = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
      }
      next.periodPreset = 'custom';
      return next;
    });
  };

  const handleCustomEndChange = (val: string) => {
    onFiltersChange((prev) => {
      const next = { ...prev };
      if (!val) {
        delete next.endDate;
      } else {
        const [y, m, d] = val.split('-').map(Number);
        next.endDate = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
      }
      next.periodPreset = 'custom';
      return next;
    });
  };

  const isCustomOpen = activePreset === 'custom' || filters.periodPreset === 'custom';

  return (
    <div className={cn('flex flex-wrap items-end gap-2 shrink-0 min-w-0', className)}>
      {/* Seletor Dropdown de Presets */}
      <div className="grid gap-1.5 shrink-0 min-w-0">
        <Label>{t('period')}</Label>
        <Select
          value={isCustomOpen ? 'custom' : activePreset}
          onValueChange={(val) => applyPreset(val as DatePresetKey)}
        >
          <SelectTrigger className="w-full sm:w-[150px] lg:w-[145px] xl:w-[160px] 2xl:w-[170px] h-9">
            <SelectValue placeholder={t('filterByPeriod')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all_period')}</SelectItem>
            <SelectItem value="current_month">{t('preset_current_month')}</SelectItem>
            <SelectItem value="previous_month">{t('preset_previous_month')}</SelectItem>
            <SelectItem value="today">{t('preset_today')}</SelectItem>
            <SelectItem value="last_7_days">{t('preset_last_7_days')}</SelectItem>
            <SelectItem value="last_30_days">{t('preset_last_30_days')}</SelectItem>
            <SelectItem value="last_90_days">{t('preset_last_90_days')}</SelectItem>
            <SelectItem value="custom">{t('preset_custom')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inputs customizados de Data Inicial e Data Final */}
      {isCustomOpen && (
        <div className="flex items-end gap-2 animate-in fade-in-50 duration-150">
          <div className="grid gap-1.5 shrink-0">
            <Label className="text-[11px] text-muted-foreground">{t('startDate')}</Label>
            <Input
              type="date"
              value={startInputVal}
              onChange={(e) => handleCustomStartChange(e.target.value)}
              className="h-9 w-full sm:w-36 text-xs"
            />
          </div>
          <div className="grid gap-1.5 shrink-0">
            <Label className="text-[11px] text-muted-foreground">{t('endDate')}</Label>
            <Input
              type="date"
              value={endInputVal}
              onChange={(e) => handleCustomEndChange(e.target.value)}
              className="h-9 w-full sm:w-36 text-xs"
            />
          </div>
          {(startDateIso || endDateIso) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => applyPreset('all')}
              title={t('clearPeriod')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
