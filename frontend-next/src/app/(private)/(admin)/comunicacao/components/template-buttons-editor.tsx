'use client';

import { ArrowDown, ArrowUp, Copy, ExternalLink, Phone, Plus, Reply, Trash2 } from 'lucide-react';
import type { ComponentType } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import type {
  MessagingTemplateCategory,
  ReservedVariable,
  TemplateButton,
  TemplateVariable,
} from '@/lib/actions/messaging/types';
import {
  BUTTON_KINDS,
  LABEL_MAX,
  MAX_BUTTONS,
  canAdd,
  categoryAllowsButtons,
  emptyButton,
  slotButton,
  slotUrl,
  validateButton,
  type SlotInfo,
  type TemplateButtonKind,
} from '@/lib/messaging/template-buttons';
import { VariableInputRow } from './variable-input-row';

/** `uid` só dá chave estável ao React quando a lista é reordenada/removida; não vai para o payload. */
export interface ButtonDraft {
  uid: number;
  button: TemplateButton;
}

let nextUid = 1;
export const draftOf = (button: TemplateButton): ButtonDraft => ({ uid: nextUid++, button });
export const draftsFrom = (buttons: TemplateButton[] | null | undefined): ButtonDraft[] =>
  (buttons ?? []).map(draftOf);

const ICONS: Record<TemplateButtonKind, ComponentType<{ className?: string }>> = {
  URL: ExternalLink,
  PHONE_NUMBER: Phone,
  COPY_CODE: Copy,
  QUICK_REPLY: Reply,
};

export function ButtonKindIcon({ kind, className }: { kind: TemplateButtonKind; className?: string }) {
  const Icon = ICONS[kind];
  return <Icon className={className} />;
}

function ButtonItemField({
  button,
  slot,
  locked,
  variables,
  reserved,
  usedNames,
  onUpdate,
  t,
}: {
  button: TemplateButton;
  slot?: SlotInfo;
  locked: boolean;
  variables: TemplateVariable[];
  reserved: ReservedVariable[];
  usedNames: Set<string>;
  onUpdate: (patch: Partial<TemplateButton>) => void;
  t: (key: string) => string;
}) {
  if (slot?.kind === 'URL') {
    return (
      <div className="grid gap-1">
        <Label>{t('templateButtonUrl')}</Label>
        <code className="break-all rounded-md bg-muted px-2 py-1.5 text-xs">{slotUrl(slot)}</code>
        <p className="text-xs text-muted-foreground">{t('buttonSlotUrlHelp')}</p>
      </div>
    );
  }
  if (slot?.kind === 'QUICK_REPLY') {
    return <p className="text-xs text-muted-foreground">{t('buttonSlotQuickReplyHelp')}</p>;
  }
  if (button.kind === 'URL') {
    return (
      <VariableInputRow
        label={t('templateButtonUrl')}
        value={button.url}
        onChange={(url) => onUpdate({ url })}
        variables={variables}
        reserved={reserved}
        usedNames={usedNames}
        maxLength={2000}
        disabled={locked}
        placeholder="https://exemplo.com/pedido/{{ order_id }}"
        description={t('buttonUrlHelp')}
      />
    );
  }
  if (button.kind === 'PHONE_NUMBER') {
    return (
      <div className="grid gap-1.5">
        <Label>{t('buttonPhone')}</Label>
        <Input
          value={button.phoneNumber}
          maxLength={20}
          disabled={locked}
          placeholder="+55 11 99999-9999"
          onChange={(e) => onUpdate({ phoneNumber: e.target.value })}
        />
      </div>
    );
  }
  if (button.kind === 'COPY_CODE') {
    return <p className="text-xs text-muted-foreground">{t('buttonCopyCodeHelp')}</p>;
  }
  return <p className="text-xs text-muted-foreground">{t('buttonQuickReplyHelp')}</p>;
}

function TemplateButtonItemHeader({
  button,
  slot,
  fixed,
  index,
  total,
  draftUid,
  onMove,
  onRemove,
  t,
}: {
  button: TemplateButton;
  slot?: SlotInfo;
  fixed: boolean;
  index: number;
  total: number;
  draftUid: number;
  onMove: (index: number, delta: -1 | 1) => void;
  onRemove: (uid: number) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <ButtonKindIcon kind={button.kind} className="size-4" />
        {t(`buttonKind.${button.kind}`)}
        {slot && (
          <>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {slot.key}
            </Badge>
            {slot.reserved && <Badge variant="outline" className="text-[10px]">{t('buttonReservedBadge')}</Badge>}
            {slot.required && <Badge variant="outline" className="text-[10px]">{t('buttonRequiredBadge')}</Badge>}
          </>
        )}
      </span>
      <div className="flex items-center">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={fixed || index === 0}
          onClick={() => onMove(index, -1)}
          aria-label={t('buttonMoveUp')}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={fixed || index === total - 1}
          onClick={() => onMove(index, 1)}
          aria-label={t('buttonMoveDown')}
        >
          <ArrowDown className="size-4" />
        </Button>
        {!slot?.required && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => onRemove(draftUid)}
            aria-label={t('buttonRemove')}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function TemplateButtonItem({
  draft,
  index,
  total,
  slots,
  showErrors,
  locked,
  variables,
  reserved,
  usedNames,
  onUpdate,
  onRemove,
  onMove,
  t,
}: {
  draft: ButtonDraft;
  index: number;
  total: number;
  slots: SlotInfo[];
  showErrors: boolean;
  locked: boolean;
  variables: TemplateVariable[];
  reserved: ReservedVariable[];
  usedNames: Set<string>;
  onUpdate: (uid: number, patch: Partial<TemplateButton>) => void;
  onRemove: (uid: number) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  t: (key: string) => string;
}) {
  const { button } = draft;
  const error = showErrors ? validateButton(button) : null;
  const slot = button.slot ? slots.find((s) => s.key === button.slot) : undefined;
  const fixed = locked && !slot;

  return (
    <div
      key={draft.uid}
      className={`grid gap-3 rounded-md border p-3 ${error ? 'border-destructive' : ''}`}
    >
      <TemplateButtonItemHeader
        button={button}
        slot={slot}
        fixed={fixed}
        index={index}
        total={total}
        draftUid={draft.uid}
        onMove={onMove}
        onRemove={onRemove}
        t={t}
      />

      <div className="grid gap-1.5">
        <Label>{t('buttonLabel')}</Label>
        <Input
          value={button.label}
          maxLength={LABEL_MAX}
          disabled={fixed}
          onChange={(e) => onUpdate(draft.uid, { label: e.target.value })}
        />
        <p className="text-right text-xs text-muted-foreground">
          {button.label.length}/{LABEL_MAX}
        </p>
      </div>

      <ButtonItemField
        button={button}
        slot={slot}
        locked={locked}
        variables={variables}
        reserved={reserved}
        usedNames={usedNames}
        onUpdate={(patch) => onUpdate(draft.uid, patch)}
        t={t}
      />

      {error && <p className="text-[0.8rem] font-medium text-destructive">{t(error)}</p>}
    </div>
  );
}

function AddButtonDropdown({
  locked,
  optionalSlots,
  draftsCount,
  buttons,
  onAddSlot,
  onAddKind,
  t,
}: {
  locked: boolean;
  optionalSlots: SlotInfo[];
  draftsCount: number;
  buttons: TemplateButton[];
  onAddSlot: (slot: SlotInfo) => void;
  onAddKind: (kind: TemplateButtonKind) => void;
  t: (key: string) => string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          disabled={(locked && optionalSlots.length === 0) || draftsCount >= MAX_BUTTONS}
        >
          <Plus className="size-4" /> {t('buttonAdd')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {optionalSlots.length > 0 && (
          <>
            <DropdownMenuLabel>{t('buttonFromType')}</DropdownMenuLabel>
            {optionalSlots.map((slot) => (
              <DropdownMenuItem
                key={slot.key}
                disabled={draftsCount >= MAX_BUTTONS}
                onSelect={() => onAddSlot(slot)}
              >
                <ButtonKindIcon kind={slot.kind} className="size-4" />
                <span className="font-mono text-xs">{slot.key}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('buttonFree')}</DropdownMenuLabel>
          </>
        )}
        {BUTTON_KINDS.map((kind) => (
          <DropdownMenuItem
            key={kind}
            disabled={locked || !canAdd(buttons, kind)}
            onSelect={() => onAddKind(kind)}
          >
            <ButtonKindIcon kind={kind} className="size-4" />
            {t(`buttonKind.${kind}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TemplateButtonsEditor({
  category,
  drafts,
  onChange,
  variables,
  reserved,
  usedNames,
  showErrors,
  nativeSupported = true,
  slots = [],
}: {
  category: MessagingTemplateCategory;
  drafts: ButtonDraft[];
  onChange: (drafts: ButtonDraft[]) => void;
  variables: TemplateVariable[];
  reserved: ReservedVariable[];
  usedNames: Set<string>;
  showErrors: boolean;
  nativeSupported?: boolean;
  slots?: SlotInfo[];
}) {
  const { t } = useTranslation('messaging');

  if (!categoryAllowsButtons(category)) {
    return (
      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        {t('buttonsAuthFixed')}
      </div>
    );
  }

  const locked = !nativeSupported;
  const buttons = drafts.map((d) => d.button);
  const optionalSlots = slots.filter((s) => !s.required && !buttons.some((b) => b.slot === s.key));

  const update = (uid: number, patch: Partial<TemplateButton>) =>
    onChange(
      drafts.map((d) => (d.uid === uid ? { ...d, button: { ...d.button, ...patch } as TemplateButton } : d)),
    );
  const remove = (uid: number) => onChange(drafts.filter((d) => d.uid !== uid));
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= drafts.length) return;
    const next = [...drafts];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>{t('buttonsTitle')}</Label>
          <p className="text-xs text-muted-foreground">{t('buttonsHelp')}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {drafts.length}/{MAX_BUTTONS}
        </span>
      </div>

      {locked && (
        <div role="note" className="rounded-md border border-amber-500/60 bg-amber-500/10 p-3 text-sm">
          {drafts.length > 0 ? t('buttonsUnsupportedExisting') : t('buttonsUnsupported')}
        </div>
      )}

      {drafts.length === 0 && !locked && (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{t('buttonsEmpty')}</p>
      )}

      {drafts.map((draft, index) => (
        <TemplateButtonItem
          key={draft.uid}
          draft={draft}
          index={index}
          total={drafts.length}
          slots={slots}
          showErrors={showErrors}
          locked={locked}
          variables={variables}
          reserved={reserved}
          usedNames={usedNames}
          onUpdate={update}
          onRemove={remove}
          onMove={move}
          t={t}
        />
      ))}

      <AddButtonDropdown
        locked={locked}
        optionalSlots={optionalSlots}
        draftsCount={drafts.length}
        buttons={buttons}
        onAddSlot={(slot) => onChange([...drafts, draftOf(slotButton(slot))])}
        onAddKind={(kind) => onChange([...drafts, draftOf(emptyButton(kind))])}
        t={t}
      />
    </div>
  );
}
