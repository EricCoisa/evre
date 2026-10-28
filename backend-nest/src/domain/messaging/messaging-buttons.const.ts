import { BadRequestException } from '@nestjs/common';
import type { TemplateButton } from 'src/domain/interface/messaging-provider.interface';

/** Botões tipados de um tipo de template, em duas camadas: reservados (enum) e custom (declarados no tipo). */
export const ReservedButtonKey = {
  OPT_OUT: 'opt_out',
} as const;
export type ReservedButtonKey =
  (typeof ReservedButtonKey)[keyof typeof ReservedButtonKey];

export type ButtonSlotKind = 'QUICK_REPLY' | 'URL';

export interface ReservedButton {
  key: ReservedButtonKey;
  kind: 'QUICK_REPLY';
  /** Chave i18n do rótulo mostrado ao dev/operador (locales do front). */
  labelKey: string;
  /** Texto sugerido no botão (o operador pode trocar; por idioma, no template). */
  defaultLabel: string;
  /** `true` = pode ser liberado num tipo. `false` = só o sistema usa. */
  allowUse: boolean;
}

export const RESERVED_BUTTONS: Readonly<
  Record<ReservedButtonKey, ReservedButton>
> = {
  [ReservedButtonKey.OPT_OUT]: {
    key: ReservedButtonKey.OPT_OUT,
    kind: 'QUICK_REPLY',
    labelKey: 'button.opt_out',
    defaultLabel: 'Parar de receber',
    allowUse: true,
  },
};

export const RESERVED_BUTTON_LIST: readonly ReservedButton[] =
  Object.values(RESERVED_BUTTONS);

/** Linha de `MessagingTemplateType.buttons`. */
export interface StoredTypeButton {
  key: string;
  kind: ButtonSlotKind;
  /** Reservado liberado pelo operador: `kind`/rótulo vêm do registro, não do que foi gravado. */
  reserved?: boolean;
  /** Custom: o template DESTE tipo precisa ter o botão. Reservado nunca é obrigatório. */
  required?: boolean;
  /** `URL`: parte fixa do link, controlada pelo dev (o operador só escolhe o texto do botão). */
  urlBase?: string;
  /** `URL`: o sufixo é um token — fica mascarado no histórico, como variável `sensitive`. */
  sensitive?: boolean;
}

/** Espaço já resolvido (custom + reservados conhecidos), o formato que o resto do código consome. */
export interface ButtonSlot {
  key: string;
  kind: ButtonSlotKind;
  reserved: boolean;
  required: boolean;
  urlBase?: string;
  sensitive: boolean;
  /** Texto sugerido (só reservados). */
  defaultLabel?: string;
}

/** O que o módulo chamador informa por chave: dado do botão (`string`) ou só "liga" (`true`). */
export type ButtonValues = Record<string, string | boolean>;

/** Referência de negócio guardada na mensagem enviada: devolvida ao handler quando o cliente responde. */
export interface MessageCorrelation {
  type: string;
  id: string;
}

/** O que o handler recebe quando o cliente toca num botão com chave. */
export interface ButtonEvent {
  /** Id do evento persistido (idempotência: o mesmo toque nunca roda duas vezes com sucesso). */
  id: string;
  /** Chave do tipo de template que originou a mensagem; `null` se a origem não foi encontrada. */
  typeKey: string | null;
  buttonKey: string;
  /** Dado opcional informado pelo módulo no envio (parte depois de `:` no payload). */
  data: string | null;
  phone: string;
  connectionId: string;
  templateId: string | null;
  /** Mensagem enviada que continha o botão (nossa linha), se localizada. */
  originalMessageId: string | null;
  correlation: MessageCorrelation | null;
  /** Mensagem de entrada do toque. */
  messageId: string;
  at: Date;
}

export type ButtonHandler = (event: ButtonEvent) => Promise<void> | void;

/** `type` ausente = vale para qualquer tipo (caso dos reservados). */
export interface ButtonMatch {
  type?: string;
  button: string;
}

/** Limite do payload de resposta rápida de template (Meta). */
export const BUTTON_PAYLOAD_MAX = 128;

const PAYLOAD_RE = /^([a-z][a-z0-9_]*)(?::(.*))?$/s;

/** `chave` ou `chave:dado`. A chave é snake_case, então `:` separa sem ambiguidade. */
export function encodeButtonPayload(key: string, data?: string): string {
  const payload = data ? `${key}:${data}` : key;
  if (payload.length > BUTTON_PAYLOAD_MAX) {
    throw new BadRequestException(
      `dado do botão ${key} excede ${BUTTON_PAYLOAD_MAX - key.length - 1} caracteres`,
    );
  }
  return payload;
}

/** Payload que não segue o formato (ex.: id de botão de outro sistema) é ignorado, não é erro. */
export function decodeButtonPayload(
  payload: string,
): { key: string; data: string | null } | null {
  const match = PAYLOAD_RE.exec(payload.trim());
  return match ? { key: match[1], data: match[2] || null } : null;
}

/** Espaços de um tipo: os custom + só os reservados conhecidos e liberáveis (o resto é descartado). */
export function effectiveButtonSlots(
  stored: readonly StoredTypeButton[] | null | undefined,
  registry: readonly ReservedButton[] = RESERVED_BUTTON_LIST,
): ButtonSlot[] {
  const slots: ButtonSlot[] = [];
  for (const row of stored ?? []) {
    if (row.reserved) {
      const declared = registry.find((r) => r.key === row.key && r.allowUse);
      if (declared) {
        slots.push({
          key: declared.key,
          kind: declared.kind,
          reserved: true,
          required: false,
          sensitive: false,
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
      sensitive: row.kind === 'URL' && !!row.sensitive,
    });
  }
  return slots;
}

/** URL completa do espaço, com o placeholder do sufixo — é o que a Meta aprova. */
export function slotUrl(slot: Pick<ButtonSlot, 'key' | 'urlBase'>): string {
  return `${slot.urlBase ?? ''}{{ ${slot.key} }}`;
}

/** Variáveis (para `formatValues`) que os espaços URL acrescentam: o sufixo é sempre obrigatório. */
export function buttonSlotVariables(slots: readonly ButtonSlot[]) {
  return slots
    .filter((s) => s.kind === 'URL')
    .map((s) => ({
      name: s.key,
      type: 'STRING' as const,
      required: true,
      default: undefined as string | undefined,
    }));
}

/** Nomes de URL slots `sensitive`: entram na máscara do histórico junto com as variáveis. */
export function sensitiveButtonNames(slots: readonly ButtonSlot[]): string[] {
  return slots.filter((s) => s.kind === 'URL' && s.sensitive).map((s) => s.key);
}

/** Sufixo de URL: sem espaço, sem placeholder, sem esquema — vira o final do link controlado por nós. */
export function normalizeUrlSuffix(key: string, raw: string): string {
  const value = raw.trim();
  if (!value) {
    throw new BadRequestException(`valor do botão obrigatório ausente: ${key}`);
  }
  if (/[\s{}]/.test(value) || value.includes('://') || value.length > 500) {
    throw new BadRequestException(`valor inválido para o botão ${key}`);
  }
  return value;
}

export interface ResolvedButtons {
  /** Sufixos dos espaços URL, por chave — somam-se às variáveis do envio. */
  values: Record<string, string>;
  /** Payload das respostas rápidas, por chave. */
  payloads: Record<string, string>;
}

/** Resolve o valor final de cada espaço que o template usa, rejeitando chave informada que o template não tem. */
export function resolveButtons(
  usedSlots: readonly ButtonSlot[],
  provided: ButtonValues = {},
): ResolvedButtons {
  const known = new Set(usedSlots.map((s) => s.key));
  const unknown = Object.keys(provided).filter((key) => !known.has(key));
  if (unknown.length > 0) {
    throw new BadRequestException(
      `botão desconhecido neste template: ${unknown.join(', ')}`,
    );
  }

  const values: Record<string, string> = {};
  const payloads: Record<string, string> = {};
  for (const slot of usedSlots) {
    const value = provided[slot.key];
    if (slot.kind === 'URL') {
      values[slot.key] = normalizeUrlSuffix(
        slot.key,
        typeof value === 'string' ? value : '',
      );
    } else {
      payloads[slot.key] = encodeButtonPayload(
        slot.key,
        typeof value === 'string' ? value.trim() : undefined,
      );
    }
  }
  return { values, payloads };
}

/** Valida e normaliza os botões de um template contra os espaços obrigatórios do tipo. */
export function assertButtonsMatchSlots(
  slots: readonly ButtonSlot[],
  buttons: readonly TemplateButton[] | null | undefined,
): TemplateButton[] | undefined {
  const list = buttons ?? [];
  const bySlot = new Map(slots.map((s) => [s.key, s]));
  const seen = new Set<string>();

  const normalized = list.map((button): TemplateButton => {
    if (!button.slot) return button;
    const slot = bySlot.get(button.slot);
    if (!slot) {
      throw new BadRequestException(
        `botão do template usa um espaço que o tipo não tem: ${button.slot}`,
      );
    }
    if (seen.has(slot.key)) {
      throw new BadRequestException(`espaço de botão repetido: ${slot.key}`);
    }
    seen.add(slot.key);
    if (button.kind !== slot.kind) {
      throw new BadRequestException(
        `o espaço ${slot.key} é ${slot.kind}, não ${button.kind}`,
      );
    }
    if (slot.kind === 'URL') {
      return {
        kind: 'URL',
        label: button.label,
        url: slotUrl(slot),
        slot: slot.key,
      };
    }
    return { kind: 'QUICK_REPLY', label: button.label, slot: slot.key };
  });

  const missing = slots.filter((s) => s.required && !seen.has(s.key));
  if (missing.length > 0) {
    throw new BadRequestException(
      `botões obrigatórios do tipo ausentes: ${missing.map((s) => s.key).join(', ')}`,
    );
  }
  return list.length ? normalized : undefined;
}
