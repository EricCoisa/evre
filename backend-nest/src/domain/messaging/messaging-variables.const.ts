import { BadRequestException } from '@nestjs/common';
import dayjs from 'dayjs';

/** Registro único das variáveis reservadas, lido por API, preview, submissão à Meta e validação. */
export const ReservedVariableKey = {
  FIRST_NAME: 'first_name',
  FULL_NAME: 'full_name',
} as const;
export type ReservedVariableKey =
  (typeof ReservedVariableKey)[keyof typeof ReservedVariableKey];

/** Tudo o que um resolver pode consultar. Só o que o envio já tem em mãos — nada de buscar módulo. */
export interface VariableContext {
  contact: {
    name: string | null;
    pushName: string | null;
    phone: string;
  } | null;
  connection: { phone: string | null };
  now: Date;
}

/** O que o módulo chamador informa: a chave e o dado BRUTO — a declaração normaliza. */
export type ReservedValues = Partial<Record<ReservedVariableKey, string>>;

export interface ReservedVariable {
  name: ReservedVariableKey;
  type: 'STRING' | 'NUMBER' | 'DATE';
  /** Chave i18n do rótulo mostrado ao operador (locales do front). */
  labelKey: string;
  /** Exemplo mandado à Meta na criação do template (ela exige um por parâmetro nomeado). */
  example: string;
  /** Valor fictício do preview do editor. */
  dummy: string;
  /** Usado quando não há dado e `onMissing` é 'fallback' — a Meta recusa parâmetro vazio. */
  fallback: string;
  /** Sem dado: usa o `fallback` ou recusa o envio (variável que não admite chute). */
  onMissing: 'fallback' | 'error';
  /** `true` = o operador pode liberá-la num tipo de template (checkbox). `false` = só o sistema usa. */
  allowUse: boolean;
  /** Valor gravado mascarado no histórico (ex.: código de verificação); só o provider vê o real. */
  sensitive?: boolean;
  /** Dado de origem quando o chamador não informa. Ausente = só o chamador fornece. */
  fromContext?: (ctx: VariableContext) => string | null | undefined;
  /** Dado bruto → texto final. Lançar `BadRequestException` para dado inválido. Padrão: trim. */
  normalize?: (raw: string) => string;
}

const firstWord = (value: string) => value.trim().split(/\s+/)[0] ?? '';
const contactName = (ctx: VariableContext) =>
  ctx.contact?.name ?? ctx.contact?.pushName;

/** Normalizador de data: valida (nunca manda "Invalid Date" ao destinatário) e aplica o formato. */
export function dateNormalizer(format = 'DD/MM/YYYY') {
  return (raw: string): string => {
    const parsed = dayjs(raw);
    if (!parsed.isValid()) {
      throw new BadRequestException(`data inválida: ${raw}`);
    }
    return parsed.format(format);
  };
}

export const RESERVED_VARIABLES: Readonly<
  Record<ReservedVariableKey, ReservedVariable>
> = {
  [ReservedVariableKey.FIRST_NAME]: {
    name: ReservedVariableKey.FIRST_NAME,
    type: 'STRING',
    labelKey: 'variable.first_name',
    example: 'Ana',
    dummy: 'Ana',
    fallback: 'cliente',
    onMissing: 'fallback',
    allowUse: true,
    fromContext: contactName,
    normalize: firstWord,
  },
  [ReservedVariableKey.FULL_NAME]: {
    name: ReservedVariableKey.FULL_NAME,
    type: 'STRING',
    labelKey: 'variable.full_name',
    example: 'Ana Souza',
    dummy: 'Ana Souza',
    fallback: 'cliente',
    onMissing: 'fallback',
    allowUse: true,
    fromContext: contactName,
  },
};

export const RESERVED_LIST: readonly ReservedVariable[] =
  Object.values(RESERVED_VARIABLES);

/** Máscara do que é `sensitive` no histórico. */
export const SENSITIVE_MASK = '••••••';

/** Formato que `formatValues`/`assertBodyMatchesType` (template.util.ts) já consomem. */
interface ReservedAsVariable {
  name: string;
  type: 'STRING' | 'NUMBER' | 'DATE';
  required: boolean;
  default?: string;
}

/** Linha de `MessagingTemplateType.variables`; `reserved: true` = reservada liberada pelo operador. */
interface StoredTypeVariable {
  name: string;
  reserved?: boolean;
  sensitive?: boolean;
}

/** Só as liberáveis e conhecidas; nome desconhecido (dado do banco/cliente) é descartado. */
export function allowedReserved(
  allowed?: readonly string[],
  registry: readonly ReservedVariable[] = RESERVED_LIST,
): ReservedVariable[] {
  const set = allowed && new Set(allowed);
  return registry.filter((v) => v.allowUse && (!set || set.has(v.name)));
}

/** Reservadas no formato do `formatValues`, sempre como string já normalizada. */
export function reservedAsVariables(
  allowed?: readonly string[],
  registry: readonly ReservedVariable[] = RESERVED_LIST,
): ReservedAsVariable[] {
  return allowedReserved(allowed, registry).map((v) => ({
    name: v.name,
    type: 'STRING' as const,
    required: v.onMissing === 'error',
    ...(v.onMissing === 'fallback' ? { default: v.fallback } : {}),
  }));
}

/** Separa o que o operador declarou (custom) das reservadas que ele liberou no tipo. */
export function splitTypeVariables<T extends StoredTypeVariable>(
  stored: readonly T[],
): { custom: T[]; reservedNames: string[] } {
  return {
    custom: stored.filter((v) => !v.reserved),
    reservedNames: stored.filter((v) => v.reserved).map((v) => v.name),
  };
}

/** Variáveis que um tipo realmente oferece: as custom + só as reservadas que ele liberou. */
export function effectiveVariables(
  stored: readonly StoredTypeVariable[],
  registry: readonly ReservedVariable[] = RESERVED_LIST,
) {
  const { custom, reservedNames } = splitTypeVariables(stored);
  return [
    ...(custom as unknown as ReservedAsVariable[]),
    ...reservedAsVariables(reservedNames, registry),
  ];
}

/** Nomes (custom ou reservada liberada) cujo valor não pode ficar legível no histórico. */
export function sensitiveNames(
  stored: readonly StoredTypeVariable[],
  registry: readonly ReservedVariable[] = RESERVED_LIST,
): string[] {
  const { custom, reservedNames } = splitTypeVariables(stored);
  return [
    ...custom.filter((v) => v.sensitive).map((v) => v.name),
    ...allowedReserved(reservedNames, registry)
      .filter((v) => v.sensitive)
      .map((v) => v.name),
  ];
}

/** Resolve o valor final de cada reservada liberada, por ordem de prioridade: informado, contexto, fallback. */
export function resolveReserved(
  ctx: VariableContext,
  allowed?: readonly string[],
  provided: ReservedValues = {},
  registry: readonly ReservedVariable[] = RESERVED_LIST,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of allowedReserved(allowed, registry)) {
    const raw = (provided[v.name] ?? v.fromContext?.(ctx) ?? '').trim();
    const value = raw ? (v.normalize ? v.normalize(raw) : raw).trim() : '';
    if (value) {
      out[v.name] = value;
    } else if (v.onMissing === 'error') {
      throw new BadRequestException(
        `variável reservada obrigatória ausente: ${v.name}`,
      );
    } else {
      out[v.name] = v.fallback;
    }
  }
  return out;
}
