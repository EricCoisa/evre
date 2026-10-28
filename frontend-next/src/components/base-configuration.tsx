'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { Input } from '@/components/ui/input';
import { Description, Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import { WarningPopover } from './warning-popover';
import { useMe } from '@/lib/actions/auth/queries';

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { format, parse } from 'date-fns';
import { Checkbox } from './ui/checkbox';
import { Textarea } from './ui/textarea';
import { SwitchField } from './switch-field';
import { Button } from './ui/button';
import { cn } from '@/lib/cn';

interface ConfigurationData {
  id: string;
  labelKey: string;
  valueType: string;
  options?: string[];
  value: unknown;
  secret?: boolean;
  blocked?: boolean;
}

function isBooleanConfigValue(value: unknown): boolean {
  return value === 'true' || value === true;
}

function getControlFlags(isPending: boolean, disabled: boolean | undefined, blocked: boolean | undefined, warning: boolean | undefined) {
  const isControlDisabled = isPending || Boolean(disabled) || Boolean(blocked);
  const isWarn = !isPending && (warning ?? (Boolean(disabled) || Boolean(blocked)));
  return { isControlDisabled, isWarn };
}

export interface OtherConfigurationProps {
  labelKey: string;
  description?: string;
  forceType?: 'button' | 'switch' | 'toggle' | 'textarea' | 'checkbox';
  /** Troca o auto-save com debounce por confirmar/cancelar explícito (✓/✗). */
  manualSave?: boolean;
  showMessage?: boolean;
  className?: string;
  disableLabel?: boolean;
  invalidateKeys?: unknown[][];
  /** Desabilita o controle por uma condição externa (ex.: provider não configurado) — soma a `isPending`/`blocked`, não substitui. */
  disabled?: boolean;
  /** Sinaliza visualmente aviso de dependência externa com ícone de alerta triangular. */
  warning?: boolean;
  /** Motivo detalhado/causa técnica da inoperabilidade para ser exibido dentro do Popover. */
  warningReason?: ReactNode;
  /** Rota direta para consertar a configuração (ex.: '/settings?tab=emailConfig'). */
  fixPath?: string;
}


interface BaseConfigurationProps extends OtherConfigurationProps {
  /** `undefined` só em chave inexistente — os wrappers buscam com `useSuspenseQuery`. */
  data: ConfigurationData | null | undefined;
  isPending: boolean;
  onUpdate: (newValue: unknown) => Promise<void>;
  className?: string;
  disableLabel?: boolean;
}

function FieldHeader({
  disableLabel,
  labelKey,
  description,
  isPending,
  isWarn,
  warningReason,
  fixPath,
  t,
}: {
  disableLabel?: boolean;
  labelKey: string;
  description?: string;
  isPending?: boolean;
  isWarn?: boolean;
  warningReason?: ReactNode;
  fixPath?: string;
  t: (k: string) => string;
}) {
  const showLabel = disableLabel !== true;
  return (
    <>
      {showLabel && (
        <div className="flex items-center gap-1.5">
          <Label htmlFor={labelKey}>{t(labelKey)}</Label>
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {isWarn && <WarningPopover reason={warningReason} fixPath={fixPath} />}
        </div>
      )}
      {description && <Description>{description}</Description>}
    </>
  );
}

function resolveOptionLabel(option: string, labelKey: string, t: (k: string) => string): string {
  const specificKey = `${labelKey}_${option}`;
  const specific = t(specificKey);
  if (specific !== specificKey) return specific;

  const generic = t(option);
  if (generic !== option) return generic;

  const lowerGeneric = t(option.toLowerCase());
  if (lowerGeneric !== option.toLowerCase()) return lowerGeneric;

  return option;
}

function EnumConfigField({
  data,
  labelKey,
  description,
  disableLabel,
  isPending,
  isWarn,
  onUpdate,
  t,
}: {
  data: ConfigurationData;
  labelKey: string;
  description?: string;
  disableLabel?: boolean;
  isPending: boolean;
  isWarn?: boolean;
  onUpdate: (v: string) => void;
  t: (k: string) => string;
}) {
  const options = data.options ?? [];
  return (
    <div className="space-y-2">
      <FieldHeader
        disableLabel={disableLabel}
        labelKey={labelKey}
        description={description}
        isPending={false}
        isWarn={isWarn}
        t={t}
      />
      <Select
        value={data.value as string}
        onValueChange={onUpdate}
        disabled={isPending}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t(labelKey)} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {resolveOptionLabel(option, labelKey, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateConfigField({
  data,
  labelKey,
  description,
  disableLabel,
  isPending,
  onUpdate,
  onDebouncedUpdate,
  t,
}: {
  data: ConfigurationData;
  labelKey: string;
  description?: string;
  disableLabel?: boolean;
  isPending: boolean;
  onUpdate: (v: string) => void;
  onDebouncedUpdate: (v: string) => void;
  t: (k: string) => string;
}) {
  const valueStr = data.value as string;
  const timePattern = /^\d{2}:\d{2}:\d{2}$/;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (timePattern.test(valueStr)) {
    return (
      <div className="space-y-2">
        <FieldHeader disableLabel={disableLabel} labelKey={labelKey} description={description} t={t} />
        <Input
          id={labelKey}
          type="time"
          step="1"
          defaultValue={valueStr}
          onChange={(e) => onDebouncedUpdate(e.target.value)}
          disabled={isPending}
        />
      </div>
    );
  }

  if (datePattern.test(valueStr)) {
    const currentDate = parse(valueStr, 'yyyy-MM-dd', new Date());
    return (
      <div className="space-y-2">
        <FieldHeader disableLabel={disableLabel} labelKey={labelKey} description={description} t={t} />
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
  }

  return (
    <div className="space-y-2">
      <FieldHeader disableLabel={disableLabel} labelKey={labelKey} description={description} t={t} />
      <Input
        id={labelKey}
        type="datetime-local"
        defaultValue={valueStr}
        onChange={(e) => onDebouncedUpdate(e.target.value)}
        disabled={isPending}
      />
    </div>
  );
}

function BooleanToggleField({
  data,
  labelKey,
  description,
  disableLabel,
  isPending,
  disabled,
  warning,
  warningReason,
  fixPath,
  onUpdate,
  t,
}: {
  data: ConfigurationData;
  labelKey: string;
  description?: string;
  disableLabel?: boolean;
  isPending: boolean;
  disabled?: boolean;
  warning?: boolean;
  warningReason?: ReactNode;
  fixPath?: string;
  onUpdate: (v: string) => void;
  t: (k: string) => string;
}) {
  const isChecked = isBooleanConfigValue(data.value);
  const stateLabel = isChecked ? t('enabled') : t('disabled');
  const { isControlDisabled, isWarn } = getControlFlags(isPending, disabled, data.blocked, warning);

  const statusChip = (className: string) => (
    <div className={className}>
      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      {isWarn && <WarningPopover reason={warningReason} fixPath={fixPath} />}
      <span>{stateLabel}</span>
    </div>
  );

  const switchControl = (
    <SwitchField
      id={labelKey}
      checked={isChecked}
      onCheckedChange={(checked) => onUpdate(String(checked))}
      disabled={isControlDisabled}
      inline
    />
  );

  if (disableLabel !== true) {
    return (
      <div className="space-y-2">
        <FieldHeader
          disableLabel={disableLabel}
          labelKey={labelKey}
          description={description}
          isPending={isPending}
          isWarn={isWarn}
          warningReason={warningReason}
          fixPath={fixPath}
          t={t}
        />
        <div className="flex items-center gap-3">
          {switchControl}
          {statusChip('flex items-center gap-1.5 text-sm font-medium text-muted-foreground select-none')}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between sm:justify-end gap-3 w-full">
      {statusChip('flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground select-none')}
      {switchControl}
    </div>
  );
}

function BooleanButtonField({
  data,
  labelKey,
  description,
  isPending,
  onUpdate,
  t,
}: {
  data: ConfigurationData;
  labelKey: string;
  description?: string;
  isPending: boolean;
  onUpdate: (v: string) => void;
  t: (k: string) => string;
}) {
  const isChecked = isBooleanConfigValue(data.value);
  return (
    <>
      {description && <Description>{description}</Description>}
      <Button
        id={labelKey}
        disabled={isPending}
        onClick={() => { onUpdate(String(!data.value)); }}
        className="flex items-center gap-2"
      >
        <span
          className={
            `inline-block size-4 rounded-[4px] border transition-colors ${
              isChecked
                ? 'bg-primary border-primary text-primary-foreground'
                : 'bg-input/30 border-input'
            }`
          }
        >
          {isChecked && (
            <svg className="w-3.5 h-3.5 mx-auto" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 8L7 11L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        {t(labelKey)}
      </Button>
    </>
  );
}

function BooleanConfigField({
  data,
  labelKey,
  description,
  disableLabel,
  isPending,
  disabled,
  warning,
  warningReason,
  fixPath,
  forceType,
  onUpdate,
  t,
}: {
  data: ConfigurationData;
  labelKey: string;
  description?: string;
  disableLabel?: boolean;
  isPending: boolean;
  disabled?: boolean;
  warning?: boolean;
  warningReason?: ReactNode;
  fixPath?: string;
  forceType?: string;
  onUpdate: (v: string) => void;
  t: (k: string) => string;
}) {
  const isControlDisabled = isPending || Boolean(disabled) || Boolean(data.blocked);
  const isWarn = !isPending && (warning ?? (Boolean(disabled) || Boolean(data.blocked)));

  if (forceType === 'checkbox') {
    return (
      <div className="space-y-2">
        <FieldHeader
          disableLabel={disableLabel}
          labelKey={labelKey}
          description={description}
          isPending={isPending}
          isWarn={isWarn}
          warningReason={warningReason}
          fixPath={fixPath}
          t={t}
        />
        <Checkbox
          id={labelKey}
          checked={isBooleanConfigValue(data.value)}
          onCheckedChange={(checked: boolean) => onUpdate(String(checked))}
          disabled={isControlDisabled}
        />
      </div>
    );
  }

  if (forceType === 'button') {
    return (
      <div className="space-y-2">
        <BooleanButtonField
          data={data}
          labelKey={labelKey}
          description={description}
          isPending={isControlDisabled}
          onUpdate={onUpdate}
          t={t}
        />
      </div>
    );
  }

  // Padrão unificado para configurações booleanas: SwitchField com label e estado
  return (
    <BooleanToggleField
      data={data}
      labelKey={labelKey}
      description={description}
      disableLabel={disableLabel}
      isPending={isPending}
      disabled={disabled}
      warning={warning}
      warningReason={warningReason}
      fixPath={fixPath}
      onUpdate={onUpdate}
      t={t}
    />
  );
}

function NumberConfigField({
  data,
  labelKey,
  description,
  disableLabel,
  isPending,
  onDebouncedUpdate,
  t,
}: {
  data: ConfigurationData;
  labelKey: string;
  description?: string;
  disableLabel?: boolean;
  isPending: boolean;
  onDebouncedUpdate: (v: string) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="space-y-2">
      <FieldHeader disableLabel={disableLabel} labelKey={labelKey} description={description} t={t} />
      <Input
        id={labelKey}
        type="number"
        defaultValue={data.value as number}
        onChange={(e) => onDebouncedUpdate(e.target.value)}
        disabled={isPending}
      />
    </div>
  );
}

function ConfirmCancelButtons({
  onConfirm,
  onCancel,
  disabled,
  confirmDisabled,
  t,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  disabled: boolean;
  confirmDisabled: boolean;
  t: (k: string) => string;
}) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onConfirm}
        disabled={disabled || confirmDisabled}
        title={t('confirm')}
        className="text-green-600 hover:text-green-700"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onCancel}
        disabled={disabled}
        title={t('cancel')}
        className="text-red-600 hover:text-red-700"
      >
        <X className="h-4 w-4" />
      </Button>
    </>
  );
}

function SecretStringField({
  labelKey,
  isEditing,
  draft,
  isPending,
  showSecretValue,
  onDraftChange,
  onFocus,
  onToggleSecret,
  onConfirm,
  onCancel,
  t,
}: {
  labelKey: string;
  isEditing: boolean;
  draft: string | null;
  isPending: boolean;
  showSecretValue: boolean;
  onDraftChange: (v: string) => void;
  onFocus: () => void;
  onToggleSecret: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  t: (k: string) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        id={labelKey}
        type={showSecretValue ? 'text' : 'password'}
        value={isEditing ? (draft ?? '') : '****'}
        onChange={(e) => onDraftChange(e.target.value)}
        onFocus={onFocus}
        disabled={isPending}
        className="flex-1"
      />
      {isEditing && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleSecret}
            disabled={isPending}
            title={showSecretValue ? t('hide') : t('show')}
          >
            {showSecretValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <ConfirmCancelButtons
            onConfirm={onConfirm}
            onCancel={onCancel}
            disabled={isPending}
            confirmDisabled={!draft}
            t={t}
          />
        </>
      )}
    </div>
  );
}

function ManualSaveStringField({
  labelKey,
  forceType,
  value,
  isEditing,
  isPending,
  draft,
  onDraftChange,
  onConfirm,
  onCancel,
  t,
}: {
  labelKey: string;
  forceType?: string;
  value: string;
  isEditing: boolean;
  isPending: boolean;
  draft: string | null;
  onDraftChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  t: (k: string) => string;
}) {
  const confirmCancel = (
    <ConfirmCancelButtons
      onConfirm={onConfirm}
      onCancel={onCancel}
      disabled={isPending}
      confirmDisabled={!draft}
      t={t}
    />
  );

  if (forceType === 'textarea') {
    return (
      <div className="flex items-start gap-2">
        <Textarea
          id={labelKey}
          rows={6}
          value={value}
          onChange={(e) => onDraftChange(e.target.value)}
          disabled={isPending}
          className="flex-1"
        />
        {isEditing && <div className="flex flex-col gap-1">{confirmCancel}</div>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        id={labelKey}
        type="text"
        value={value}
        onChange={(e) => onDraftChange(e.target.value)}
        disabled={isPending}
        className="flex-1"
      />
      {isEditing && confirmCancel}
    </div>
  );
}

function StringConfigField({
  data,
  labelKey,
  description,
  disableLabel,
  forceType,
  manualSave,
  isPending,
  draft,
  isEditing,
  showSecretValue,
  onDraftChange,
  onToggleSecret,
  onConfirm,
  onCancel,
  onDebouncedUpdate,
  t,
}: {
  data: ConfigurationData;
  labelKey: string;
  description?: string;
  disableLabel?: boolean;
  forceType?: string;
  manualSave?: boolean;
  isPending: boolean;
  draft: string | null;
  isEditing: boolean;
  showSecretValue: boolean;
  onDraftChange: (v: string) => void;
  onToggleSecret: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onDebouncedUpdate: (v: string) => void;
  t: (k: string) => string;
}) {
  const stored = (data.value as string) ?? '';

  if (data.secret) {
    return (
      <div className="space-y-2">
        <FieldHeader disableLabel={disableLabel} labelKey={labelKey} description={description} t={t} />
        <SecretStringField
          labelKey={labelKey}
          isEditing={isEditing}
          draft={draft}
          isPending={isPending}
          showSecretValue={showSecretValue}
          onDraftChange={onDraftChange}
          onFocus={() => { if (!isEditing) onDraftChange(''); }}
          onToggleSecret={onToggleSecret}
          onConfirm={onConfirm}
          onCancel={onCancel}
          t={t}
        />
      </div>
    );
  }

  if (manualSave) {
    const value = draft ?? stored;
    return (
      <div className="space-y-2">
        <FieldHeader disableLabel={disableLabel} labelKey={labelKey} description={description} t={t} />
        <ManualSaveStringField
          labelKey={labelKey}
          forceType={forceType}
          value={value}
          isEditing={isEditing}
          isPending={isPending}
          draft={draft}
          onDraftChange={onDraftChange}
          onConfirm={onConfirm}
          onCancel={onCancel}
          t={t}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <FieldHeader disableLabel={disableLabel} labelKey={labelKey} description={description} t={t} />
      {forceType === 'textarea' ? (
        <Textarea
          id={labelKey}
          rows={6}
          defaultValue={stored}
          onChange={(e) => onDebouncedUpdate(e.target.value)}
          disabled={isPending}
        />
      ) : (
        <Input
          id={labelKey}
          type="text"
          defaultValue={stored}
          onChange={(e) => onDebouncedUpdate(e.target.value)}
          disabled={isPending}
        />
      )}
    </div>
  );
}

function ConfigFieldDispatcher({
  data,
  labelKey,
  description,
  disableLabel,
  forceType,
  manualSave,
  isPending,
  disabled,
  warning,
  warningReason,
  fixPath,
  draft,
  isEditing,
  showSecretValue,
  onUpdate,
  onDebouncedUpdate,
  onDraftChange,
  onToggleSecret,
  onConfirm,
  onCancel,
  t,
}: {
  data: ConfigurationData;
  labelKey: string;
  description?: string;
  disableLabel?: boolean;
  forceType?: string;
  manualSave?: boolean;
  isPending: boolean;
  disabled?: boolean;
  warning?: boolean;
  warningReason?: ReactNode;
  fixPath?: string;
  draft: string | null;
  isEditing: boolean;
  showSecretValue: boolean;
  onUpdate: (v: unknown) => void;
  onDebouncedUpdate: (v: string) => void;
  onDraftChange: (v: string) => void;
  onToggleSecret: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  t: (k: string) => string;
}) {
  const valueType = data.valueType;
  const options = valueType === 'ENUM' && data.options?.length ? data.options : null;
  const { isControlDisabled, isWarn } = getControlFlags(isPending, disabled, data.blocked, warning);

  if (options) {
    return (
      <EnumConfigField
        data={data}
        labelKey={labelKey}
        description={description}
        disableLabel={disableLabel}
        isPending={isControlDisabled}
        isWarn={isWarn}
        onUpdate={(v) => onUpdate(v)}
        t={t}
      />
    );
  }

  const normalizedType = valueType.toLowerCase();
  switch (normalizedType) {
    case 'date':
      return (
        <DateConfigField
          data={data}
          labelKey={labelKey}
          description={description}
          disableLabel={disableLabel}
          isPending={isControlDisabled}
          onUpdate={(v) => onUpdate(v)}
          onDebouncedUpdate={onDebouncedUpdate}
          t={t}
        />
      );
    case 'boolean':
      return (
        <BooleanConfigField
          data={data}
          labelKey={labelKey}
          description={description}
          disableLabel={disableLabel}
          isPending={isPending}
          disabled={disabled}
          warning={warning}
          warningReason={warningReason}
          fixPath={fixPath}
          forceType={forceType}
          onUpdate={(v) => onUpdate(v)}
          t={t}
        />
      );
    case 'number':
    case 'numeric':
      return (
        <NumberConfigField
          data={data}
          labelKey={labelKey}
          description={description}
          disableLabel={disableLabel}
          isPending={isControlDisabled}
          onDebouncedUpdate={onDebouncedUpdate}
          t={t}
        />
      );
    case 'string':
    default:
      return (
        <StringConfigField
          data={data}
          labelKey={labelKey}
          description={description}
          disableLabel={disableLabel}
          forceType={forceType}
          manualSave={manualSave}
          isPending={isControlDisabled}
          draft={draft}
          isEditing={isEditing}
          showSecretValue={showSecretValue}
          onDraftChange={onDraftChange}
          onToggleSecret={onToggleSecret}
          onConfirm={onConfirm}
          onCancel={onCancel}
          onDebouncedUpdate={onDebouncedUpdate}
          t={t}
        />
      );
  }
}

export function BaseConfiguration({
  labelKey,
  description,
  data,
  isPending,
  disabled,
  warning,
  warningReason,
  fixPath,
  onUpdate,
  forceType,
  manualSave,
  className,
  disableLabel,
}: BaseConfigurationProps) {
  const { t } = useTranslation();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const flashTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [draft, setDraft] = useState<string | null>(null);
  const [showSecretValue, setShowSecretValue] = useState(false);
  const isEditing = draft !== null;

  const [saveStatus, setSaveStatus] = useState<'idle' | 'editing' | 'success' | 'error'>('idle');

  const runUpdate = async (newValue: unknown) => {
    try {
      await onUpdate(newValue);
      setSaveStatus('success');
    } catch {
      setSaveStatus('error');
    } finally {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1000);
    }
  };

  const handleDebouncedUpdate = (newValue: unknown) => {
    setSaveStatus('editing');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      runUpdate(newValue);
    }, 1000);
  };

  const confirmDraft = () => {
    if (draft !== null) runUpdate(draft);
    setDraft(null);
    setShowSecretValue(false);
  };

  const cancelDraft = () => {
    setDraft(null);
    setShowSecretValue(false);
  };

  const { data: user } = useMe();

  if (!data) {
    return <div>{t('not_found') + " " + t("the_key") + " " + t(labelKey)} </div>;
  }

  const hasNoAccessToConfigure = user?.role != null && user.role !== 'ADMIN';
  const effectiveWarning = hasNoAccessToConfigure ? false : warning;
  const effectiveWarningReason = hasNoAccessToConfigure ? undefined : warningReason;
  const effectiveFixPath = hasNoAccessToConfigure ? undefined : fixPath;

  const statusBorderColor = {
    idle: 'transparent',
    editing: 'var(--warning)',
    success: 'var(--success)',
    error: 'var(--destructive)',
  }[saveStatus];

  return (
    <div
      className={cn('grid gap-2 rounded-md p-2 transition-colors duration-300', className)}
      style={{ border: `2px solid ${statusBorderColor}`, backgroundColor: `${statusBorderColor}` }}
    >
      <ConfigFieldDispatcher
        data={data}
        labelKey={labelKey}
        description={description}
        disableLabel={disableLabel}
        forceType={forceType}
        manualSave={manualSave}
        isPending={isPending}
        disabled={disabled}
        warning={effectiveWarning}
        warningReason={effectiveWarningReason}
        fixPath={effectiveFixPath}
        draft={draft}
        isEditing={isEditing}
        showSecretValue={showSecretValue}
        onUpdate={runUpdate}
        onDebouncedUpdate={handleDebouncedUpdate}
        onDraftChange={setDraft}
        onToggleSecret={() => setShowSecretValue(!showSecretValue)}
        onConfirm={confirmDraft}
        onCancel={cancelDraft}
        t={t}
      />
    </div>
  );
}
