'use client';

import { useRef } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { Input } from '@/components/ui/input';
import { Description, Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { format, parse } from 'date-fns';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface ConfigurationData {
  id: string;
  labelKey: string;
  valueType: string;
  value: unknown;
}

export interface OtherConfigurationProps {
  labelKey: string;
  description?: string;
  forceType?: 'button';
  showMessage?: boolean;
  className?: string;
  disableLabel?: boolean;
  secret?: boolean;
}


interface BaseConfigurationProps extends OtherConfigurationProps {

  data: ConfigurationData | null | undefined;
  error: unknown;
  isLoading: boolean;
  isPending: boolean;
  onUpdate: (newValue: unknown) => Promise<void>;
  className?: string;
  disableLabel?: boolean;
}

export function BaseConfiguration({
  labelKey,
  description,
  data,
  error,
  isLoading,
  isPending,
  onUpdate,
  forceType,
  className,
  disableLabel,
  secret
}: BaseConfigurationProps) {
  const { t } = useTranslation();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleDebouncedUpdate = (newValue: unknown) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onUpdate(newValue);
    }, 1000);
  };

  if (isLoading) {
    return <div>{t('loading')}</div>;
  }

  if (error) {
    return <div>{t('error_loading')}</div>;
  }

  if (!data) {
    return <div>{t('not_found') + " " + t("the_key") + " " + t(labelKey)} </div>;
  }

  const renderField = () => {
    const valueType = data.valueType;
    let options: string[] | null = null;

    try {
      const parsed = JSON.parse(valueType);
      if (Array.isArray(parsed)) {
        options = parsed;
      }
    } catch {
      const arrayMatch = valueType.match(/^\[(.+)\]$/);
      if (arrayMatch) {
        options = arrayMatch[1].split(',').map((item) => item.trim());
      }
    }

    if (options) {
      return (
        <div className="space-y-2">
          {(disableLabel == undefined || disableLabel == false) && <Label htmlFor={labelKey}>{t(labelKey)}</Label>}
          {description && <Description>{description}</Description>}
          <Select
            value={data.value as string}
            onValueChange={(value) => onUpdate(value)}
            disabled={isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t(labelKey)} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    const normalizedType = valueType.toLowerCase();

    switch (normalizedType) {
      case 'date': {
        const valueStr = data.value as string;
        const timePattern = /^\d{2}:\d{2}:\d{2}$/;
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;

        if (timePattern.test(valueStr)) {
          return (
            <div className="space-y-2">
              {(disableLabel == undefined || disableLabel == false) && <Label htmlFor={labelKey}>{t(labelKey)}</Label>}
              {description && <Description>{description}</Description>}
              <Input
                id={labelKey}
                type="time"
                step="1"
                defaultValue={valueStr}
                onChange={(e) => handleDebouncedUpdate(e.target.value)}
                disabled={isPending}
              />
            </div>
          );
        } else if (datePattern.test(valueStr)) {
          const currentDate = parse(valueStr, 'yyyy-MM-dd', new Date());
          return (
            <div className="space-y-2">
              {(disableLabel == undefined || disableLabel == false) && <Label htmlFor={labelKey}>{t(labelKey)}</Label>}
              <DatePicker
                date={currentDate}
                onDateChange={(date) => {
                  if (date) {
                    onUpdate(format(date, 'yyyy-MM-dd'));
                  }
                }}
                placeholder={t(labelKey) ?? 'Select date'}
                disabled={isPending}
              />
            </div>
          );
        } else {
          return (
            <div className="space-y-2">
              {(disableLabel == undefined || disableLabel == false) && <Label htmlFor={labelKey}>{t(labelKey)}</Label>}
              {description && <Description>{description}</Description>}
              <Input
                id={labelKey}
                type="datetime-local"
                defaultValue={valueStr}
                onChange={(e) => handleDebouncedUpdate(e.target.value)}
                disabled={isPending}
              />
            </div>
          );
        }
      }

      case 'boolean':
        return (
          <div className="space-y-2">

            {forceType !== 'button' ? (
              <>
                {(disableLabel == undefined || disableLabel == false) && <Label htmlFor={labelKey}>{t(labelKey)}</Label>}
                {description && <Description>{description}</Description>}

                <Checkbox
                  id={labelKey}
                  checked={data.value === 'true' || data.value === true}
                  onCheckedChange={(checked: boolean) => onUpdate(String(checked))}
                  disabled={isPending}
                />
              </>
            )
              : (
                <>
                  {description && <Description>{description}</Description>}
                  <Button
                    id={labelKey}
                    disabled={isPending}
                    onClick={() => { onUpdate(String(!data.value)) }}
                    className="flex items-center gap-2"
                  >
                    <span
                      className={
                        `inline-block size-4 rounded-[4px] border transition-colors ${
                          data.value === 'true' || data.value === true
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'bg-input/30 border-input'
                        }`
                      }
                    >
                      {data.value === 'true' || data.value === true && (
                        <svg className="w-3.5 h-3.5 mx-auto" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 8L7 11L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {t(labelKey)}
                  </Button>
                </>
              )}
          </div>
        );

      case 'number':
      case 'numeric':
        return (
          <div className="space-y-2">
            {(disableLabel == undefined || disableLabel == false) && <Label htmlFor={labelKey}>{t(labelKey)}</Label>}
            {description && <Description>{description}</Description>}
            <Input
              id={labelKey}
              type="number"
              defaultValue={data.value as number}
              onChange={(e) => handleDebouncedUpdate(e.target.value)}
              disabled={isPending}
            />
          </div>
        );

      case 'string':
      default:
        return (
          <div className="space-y-2">
            {(disableLabel == undefined || disableLabel == false) && <Label htmlFor={labelKey}>{t(labelKey)}</Label>}
            {description && <Description>{description}</Description>}
            <Input
              id={labelKey}
              type={secret ? "password" : "text"}
              defaultValue={data.value as string}
              onChange={(e) => handleDebouncedUpdate(e.target.value)}
              disabled={isPending}            
            />
          </div>
        );
    }
  };

  return (
    <div className={cn(`grid gap-2 ${className}`)}>
      {renderField()}
    </div>
  );
}
