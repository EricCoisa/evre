import type {
  MessagingTemplateCategory,
  ReservedButton,
  TemplateButton,
  TemplateButtonSlot,
} from '@/lib/actions/messaging/types';
import { usedVariableNames } from './template-variables';

export type TemplateButtonKind = TemplateButton['kind'];

/** Espelha MAX_TEMPLATE_BUTTONS / MAX_TEMPLATE_BUTTONS_BY_KIND do backend (messaging-template.dto.ts). */
export const MAX_BUTTONS = 10;
export const MAX_BY_KIND: Partial<Record<TemplateButtonKind, number>> = {
  URL: 2,
  PHONE_NUMBER: 1,
  COPY_CODE: 1,
};
export const BUTTON_KINDS: TemplateButtonKind[] = ['URL', 'PHONE_NUMBER', 'COPY_CODE', 'QUICK_REPLY'];
export const LABEL_MAX = 25;

/** Autenticação tem botão fixo da Meta ("Copiar código"): botões nossos são ignorados lá. */
export function categoryAllowsButtons(category: MessagingTemplateCategory): boolean {
  return category !== 'AUTHENTICATION';
}

export function countOf(buttons: TemplateButton[], kind: TemplateButtonKind): number {
  return buttons.filter((b) => b.kind === kind).length;
}

/** Cabe mais um botão deste tipo? Respeita o teto total e o teto do tipo. */
export function canAdd(buttons: TemplateButton[], kind: TemplateButtonKind): boolean {
  if (buttons.length >= MAX_BUTTONS) return false;
  const max = MAX_BY_KIND[kind];
  return max === undefined || countOf(buttons, kind) < max;
}

export function emptyButton(kind: TemplateButtonKind): TemplateButton {
  switch (kind) {
    case 'URL':
      return { kind, label: '', url: '' };
    case 'PHONE_NUMBER':
      return { kind, label: '', phoneNumber: '' };
    case 'COPY_CODE':
      return { kind, label: 'Copiar código' };
    case 'QUICK_REPLY':
      return { kind, label: '' };
  }
}

/** Ordena botões de ação antes dos de resposta rápida, preservando a ordem dentro de cada grupo. */
export function orderButtons<T extends { kind: TemplateButtonKind }>(buttons: T[]): T[] {
  const actions = buttons.filter((b) => b.kind !== 'QUICK_REPLY');
  const replies = buttons.filter((b) => b.kind === 'QUICK_REPLY');
  return [...actions, ...replies];
}

const URL_RE = /^https?:\/\/.+/;
const PHONE_RE = /^\+?[0-9][0-9\s().-]{5,}$/;

/** Chave i18n (namespace messaging) do problema do botão, ou `null` se estiver válido. */
export function validateButton(button: TemplateButton): string | null {
  if (!button.label.trim()) return 'buttonErrLabel';
  if (button.kind === 'URL') {
    if (!URL_RE.test(button.url.trim())) return 'buttonErrUrl';
    const names = [...usedVariableNames(button.url)];
    if (names.length > 1) return 'buttonErrUrlVars';
    if (names.length === 1 && !button.url.trim().endsWith('}}')) return 'buttonErrUrlVars';
  }
  if (button.kind === 'PHONE_NUMBER' && !PHONE_RE.test(button.phoneNumber.trim())) {
    return 'buttonErrPhone';
  }
  return null;
}

/** Normaliza para o payload: apara textos e põe as respostas rápidas por último. */
export function toPayload(buttons: TemplateButton[]): TemplateButton[] {
  return orderButtons(buttons).map((button) => {
    const label = button.label.trim();
    switch (button.kind) {
      case 'URL':
        return { ...button, label, url: button.url.trim() };
      case 'PHONE_NUMBER':
        return { ...button, label, phoneNumber: button.phoneNumber.trim() };
      default:
        return { ...button, label };
    }
  });
}

/** Espaço de botão do tipo, já resolvido (custom + reservados liberados) — espelha `ButtonSlot` do backend. */
export interface SlotInfo {
  key: string;
  kind: 'QUICK_REPLY' | 'URL';
  reserved: boolean;
  required: boolean;
  urlBase?: string;
  /** Só reservados: texto sugerido no botão. */
  defaultLabel?: string;
}

/** Espaços de um tipo; reservado desconhecido (já removido do código) é descartado, como no backend. */
export function slotsOf(
  stored: TemplateButtonSlot[] | undefined,
  reserved: ReservedButton[],
): SlotInfo[] {
  const slots: SlotInfo[] = [];
  for (const row of stored ?? []) {
    if (row.reserved) {
      const declared = reserved.find((r) => r.key === row.key && r.allowUse);
      if (declared) {
        slots.push({
          key: declared.key,
          kind: declared.kind,
          reserved: true,
          required: false,
          defaultLabel: declared.defaultLabel,
        });
      }
      continue;
    }
    slots.push({
      key: row.key,
      kind: row.kind,
      reserved: false,
      required: row.required ?? true,
      urlBase: row.kind === 'URL' ? row.urlBase : undefined,
    });
  }
  return slots;
}

/** URL completa do espaço (base do tipo + placeholder do sufixo): o que o servidor grava e a Meta aprova. */
export const slotUrl = (slot: Pick<SlotInfo, 'key' | 'urlBase'>): string =>
  `${slot.urlBase ?? ''}{{ ${slot.key} }}`;

/** Botão inicial de um espaço: só o texto é do operador; o resto vem do tipo. */
export function slotButton(slot: SlotInfo, label = slot.defaultLabel ?? ''): TemplateButton {
  return slot.kind === 'URL'
    ? { kind: 'URL', label, url: slotUrl(slot), slot: slot.key }
    : { kind: 'QUICK_REPLY', label, slot: slot.key };
}

/** Troca os botões de espaço ao mudar de tipo, mantendo os livres e criando os obrigatórios do novo tipo. */
export function rebaseOnSlots(
  buttons: TemplateButton[],
  slots: SlotInfo[],
): TemplateButton[] {
  const kept = buttons.filter((b) => {
    if (!b.slot) return true;
    const slot = slots.find((s) => s.key === b.slot);
    return !!slot && slot.kind === b.kind;
  });
  return withRequiredSlots(kept, slots);
}

/** Só acrescenta as linhas dos espaços obrigatórios que faltam (template antigo, tipo que ganhou espaço). */
export function withRequiredSlots(
  buttons: TemplateButton[],
  slots: SlotInfo[],
): TemplateButton[] {
  const missing = slots.filter((s) => s.required && !buttons.some((b) => b.slot === s.key));
  return [...missing.map((s) => slotButton(s)), ...buttons];
}
