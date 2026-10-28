'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TFunc } from '@/hooks/use-translation';
import type { ReservedButton, TemplateButtonSlot } from '@/lib/actions/messaging/types';
import { ButtonKindIcon } from './template-buttons-editor';

type Handler = { type?: string | null; button: string };

/** Há código reagindo ao toque? `type` nulo no registro = vale para qualquer tipo (reservados). */
export const hasHandler = (handlers: Handler[], typeKey: string, button: string) =>
  handlers.some((h) => h.button === button && (h.type == null || h.type === typeKey));

/** Checkbox por botão reservado: o comportamento já vem embutido no sistema (ex.: opt_out). */
export function ReservedButtonsPicker({
  t,
  reserved,
  value,
  onChange,
}: {
  t: TFunc;
  reserved: ReservedButton[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  // Em "criar" o FormBuilder entrega '' em vez de array.
  const selected = Array.isArray(value) ? value : [];
  const toggle = (key: string, checked: boolean) =>
    onChange(checked ? [...selected, key] : selected.filter((k) => k !== key));

  const available = reserved.filter((b) => b.allowUse);
  if (available.length === 0) return null;
  return (
    <div className="space-y-2">
      {available.map((b) => (
        <div key={b.key} className="flex items-center gap-2">
          <Checkbox
            id={`reserved-button-${b.key}`}
            checked={selected.includes(b.key)}
            onCheckedChange={(c) => toggle(b.key, c === true)}
          />
          <Label htmlFor={`reserved-button-${b.key}`} className="font-normal">
            <span className="font-mono text-xs">{b.key}</span>
            <span className="ml-2 text-muted-foreground">{t(b.labelKey)}</span>
          </Label>
        </div>
      ))}
    </div>
  );
}

function SlotUrlBaseField({
  slot,
  index,
  urlError,
  onUpdate,
  t,
}: {
  slot: TemplateButtonSlot;
  index: number;
  urlError?: string;
  onUpdate: (patch: Partial<TemplateButtonSlot>) => void;
  t: (key: string) => string;
}) {
  if (slot.kind !== 'URL') return null;

  return (
    <div className="grid gap-1">
      <Label className="text-xs">{t('buttonSlotUrlBase')}</Label>
      <Input
        className={urlError ? 'border-destructive' : ''}
        value={slot.urlBase ?? ''}
        placeholder="https://app.exemplo.com/pedido/"
        onChange={(e) => onUpdate({ urlBase: e.target.value })}
      />
      <p className="text-xs text-muted-foreground">{t('buttonSlotUrlBaseHelp')}</p>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`slot-sensitive-${index}`}
          checked={Boolean(slot.sensitive)}
          onCheckedChange={(c) => onUpdate({ sensitive: c === true })}
        />
        <Label htmlFor={`slot-sensitive-${index}`} className="text-xs font-normal">
          {t('buttonSlotSensitive')}
        </Label>
      </div>
    </div>
  );
}

function SlotQuickReplyHandlerBadge({
  slot,
  registered,
  t,
}: {
  slot: TemplateButtonSlot;
  registered: boolean;
  t: (key: string) => string;
}) {
  if (slot.kind !== 'QUICK_REPLY' || !slot.key) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={registered ? 'default' : 'outline'} className="text-xs">
        {registered ? t('buttonHandlerYes') : t('buttonHandlerNo')}
      </Badge>
      {!registered && (
        <span className="text-xs text-muted-foreground">{t('buttonHandlerHint')}</span>
      )}
    </div>
  );
}

function TemplateButtonSlotRow({
  slot,
  index,
  keyError,
  urlError,
  isLocked,
  registered,
  onUpdate,
  onRemove,
  t,
}: {
  slot: TemplateButtonSlot;
  index: number;
  keyError?: string;
  urlError?: string;
  isLocked: boolean;
  registered: boolean;
  onUpdate: (patch: Partial<TemplateButtonSlot>) => void;
  onRemove: () => void;
  t: (key: string) => string;
}) {
  return (
    <div key={index} className="grid gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label className="text-xs">{t('buttonSlotKey')}</Label>
          <Input
            className={`w-40 font-mono ${keyError ? 'border-destructive' : ''}`}
            value={slot.key}
            placeholder="details"
            disabled={isLocked}
            onChange={(e) => onUpdate({ key: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">{t('buttonSlotKind')}</Label>
          <Select
            value={slot.kind}
            disabled={isLocked}
            onValueChange={(kind) =>
              onUpdate({
                kind: kind as TemplateButtonSlot['kind'],
                urlBase: kind === 'URL' ? (slot.urlBase ?? '') : undefined,
                sensitive: kind === 'URL' ? slot.sensitive : undefined,
              })
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="QUICK_REPLY">
                <ButtonKindIcon kind="QUICK_REPLY" className="mr-1 inline size-3" />
                {t('buttonKind.QUICK_REPLY')}
              </SelectItem>
              <SelectItem value="URL">
                <ButtonKindIcon kind="URL" className="mr-1 inline size-3" />
                {t('buttonSlotKindUrl')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Checkbox
            id={`slot-required-${index}`}
            checked={slot.required ?? true}
            onCheckedChange={(c) => onUpdate({ required: c === true })}
          />
          <Label htmlFor={`slot-required-${index}`} className="text-xs">
            {t('variableRequired')}
          </Label>
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t('buttonRemove')}
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <SlotUrlBaseField
        slot={slot}
        index={index}
        urlError={urlError}
        onUpdate={onUpdate}
        t={t}
      />

      <SlotQuickReplyHandlerBadge
        slot={slot}
        registered={registered}
        t={t}
      />

      {(keyError || urlError) && (
        <p className="text-[0.8rem] font-medium text-destructive">{keyError ?? urlError}</p>
      )}
    </div>
  );
}

/** Editor de botões custom: o dev registra a chave no `ButtonHandlerRegistry`, o operador só escolhe o texto. */
export function ButtonSlotsEditor({
  t,
  value,
  onChange,
  handlers,
  lockedKeys,
}: {
  t: TFunc;
  value: TemplateButtonSlot[];
  onChange: (value: TemplateButtonSlot[]) => void;
  handlers: Handler[];
  lockedKeys: Set<string>;
}) {
  const {
    watch,
    formState: { errors },
  } = useFormContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slotErrors = errors.buttons as any;
  const typeKey = String(watch('key') ?? '');

  const slots = Array.isArray(value) ? value : [];
  const update = (index: number, patch: Partial<TemplateButtonSlot>) =>
    onChange(slots.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const add = (kind: TemplateButtonSlot['kind']) =>
    onChange([
      ...slots,
      { key: '', kind, required: true, ...(kind === 'URL' ? { urlBase: '' } : {}) },
    ]);

  return (
    <div className="space-y-2">
      {slots.map((slot, index) => (
        <TemplateButtonSlotRow
          key={index}
          slot={slot}
          index={index}
          keyError={slotErrors?.[index]?.key?.message}
          urlError={slotErrors?.[index]?.urlBase?.message}
          isLocked={lockedKeys.has(slot.key)}
          registered={Boolean(slot.key) && hasHandler(handlers, typeKey, slot.key)}
          onUpdate={(patch) => update(index, patch)}
          onRemove={() => onChange(slots.filter((_, i) => i !== index))}
          t={t}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => add('QUICK_REPLY')}>
          <Plus className="size-4" /> {t('buttonSlotAddQuick')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => add('URL')}>
          <Plus className="size-4" /> {t('buttonSlotAddUrl')}
        </Button>
      </div>
    </div>
  );
}
