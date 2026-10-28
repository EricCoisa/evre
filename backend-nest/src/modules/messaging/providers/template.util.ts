import { BadRequestException } from '@nestjs/common';
import dayjs from 'dayjs';
import { renderTemplate } from 'src/common/utils/email.util';
import type {
  ResolvedTemplate,
  TemplateButton,
  TemplateHeader,
} from 'src/domain/interface/messaging-provider.interface';

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/** Nome no catálogo do provider (snake_case do key, ex.: `PASSWORD_CHANGED` → `password_changed`). */
export function catalogName(key: string): string {
  return key.toLowerCase();
}

/** Nomes de variável usados em `{{ nome }}` — mesma sintaxe de `renderTemplate` (email.util). */
export function extractPlaceholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_RE)].map((match) => match[1]);
}

/** `{{ nome }}` → `{{nome}}`: formato exigido pela Meta no texto submetido. */
export function compactPlaceholders(text: string): string {
  return text.replace(PLACEHOLDER_RE, (_, name: string) => `{{${name}}}`);
}

interface VariableDef {
  name: string;
  type: 'STRING' | 'NUMBER' | 'DATE';
  required: boolean;
  default?: string;
  format?: string;
}

function formatByType(def: VariableDef, value: string): string {
  // ponytail: só DATE ganha formatação dedicada; NUMBER segue cru até haver caso real de uso.
  if (def.type !== 'DATE') return value;
  const parsed = dayjs(value);
  if (!parsed.isValid()) {
    throw new BadRequestException(`data inválida em ${def.name}: ${value}`);
  }
  return parsed.format(def.format ?? 'DD/MM/YYYY');
}

/** Resolve os valores finais: usa o que foi informado, ou o `default` de quem é opcional. */
export function formatValues(
  variables: VariableDef[],
  raw: Record<string, string> | undefined,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const def of variables) {
    const provided = raw?.[def.name]?.trim();
    if (provided) {
      values[def.name] = formatByType(def, provided);
      continue;
    }
    if (def.required === false && def.default) {
      values[def.name] = def.default;
      continue;
    }
    throw new BadRequestException(`variável obrigatória ausente: ${def.name}`);
  }
  return values;
}

/** Interpola o corpo do template com `renderTemplate` — mesma sintaxe e escape do e-mail. */
export function renderBody(
  body: string,
  values: Record<string, string>,
): string {
  return renderTemplate(body, values);
}

interface TemplateBodyParts {
  body: string;
  header?: { text?: string } | null;
  footer?: string | null;
  // `kind` entra só para o TS não recusar o union de botões como "weak type" sem propriedade em comum.
  buttons?: { kind?: string; url?: string }[] | null;
}

function usedNames(parts: TemplateBodyParts): Set<string> {
  const texts = [
    parts.body,
    parts.header?.text,
    parts.footer,
    ...(parts.buttons ?? []).map((b) => b.url),
  ].filter((text): text is string => !!text);
  return new Set(texts.flatMap(extractPlaceholders));
}

/** Deriva o envio se sobrar `{{ variável }}` crua no corpo, header, footer ou URL de botão. */
export function assertAllResolved(
  parts: TemplateBodyParts,
  values: Record<string, string>,
): void {
  const missing = [...usedNames(parts)].filter((name) => !(name in values));
  if (missing.length > 0) {
    throw new BadRequestException(
      `variável sem valor no envio: ${missing.join(', ')}`,
    );
  }
}

/** Garante que toda `{{ variável }}` usada no template existe no tipo — senão renderiza vazio em silêncio. */
export function assertBodyMatchesType(
  variables: Pick<VariableDef, 'name'>[],
  parts: TemplateBodyParts,
): void {
  const known = new Set(variables.map((v) => v.name));
  const used = usedNames(parts);
  const unknown = [...used].filter((name) => !known.has(name));
  if (unknown.length > 0) {
    throw new BadRequestException(
      `variável desconhecida no template: ${unknown.join(', ')}`,
    );
  }
}

/** Cobra todas as variáveis `required: true` explícito do tipo no `formatValues`. */
export function assertRequiredVariablesUsed(
  variables: readonly (Pick<VariableDef, 'name'> & { required?: boolean })[],
  parts: TemplateBodyParts,
): void {
  const used = usedNames(parts);
  const unused = variables
    .filter((v) => v.required === true && !used.has(v.name))
    .map((v) => v.name);
  if (unused.length > 0) {
    throw new BadRequestException(
      `variáveis obrigatórias do tipo não usadas no texto: ${unused.join(', ')}`,
    );
  }
}

function flattenButton(button: TemplateButton): string | null {
  switch (button.kind) {
    case 'URL':
      return `${button.label}: ${button.url}`;
    case 'PHONE_NUMBER':
      return `${button.label}: ${button.phoneNumber}`;
    case 'QUICK_REPLY':
      return button.label;
    // O código já está no corpo — o botão nativo só o copia, não acrescenta informação.
    case 'COPY_CODE':
      return null;
  }
}

interface RenderableParts {
  values?: Record<string, string>;
  header?: TemplateHeader | null;
  footer?: string | null;
  buttons?: TemplateButton[] | null;
}

/** Aplica os valores no header, footer e URL de botão, que chegam com `{{ }}` ainda não renderizado. */
export function renderResolvedParts(parts: RenderableParts): {
  header?: TemplateHeader;
  footer?: string;
  buttons?: TemplateButton[];
} {
  const values = parts.values ?? {};
  return {
    header: parts.header
      ? { ...parts.header, text: renderBody(parts.header.text, values) }
      : undefined,
    footer: parts.footer ? renderBody(parts.footer, values) : undefined,
    buttons: parts.buttons?.map((button) =>
      button.kind === 'URL'
        ? { ...button, url: renderBody(button.url, values) }
        : button,
    ),
  };
}

/** Achata header/corpo/footer/botões em texto único — o que `sendText` dos dois Evolution aceita. */
export function flattenTemplate(resolved: ResolvedTemplate): { text: string } {
  const { header, footer, buttons } = renderResolvedParts(resolved);
  const lines: string[] = [];
  if (header?.kind === 'TEXT') lines.push(header.text);
  lines.push(resolved.body);
  if (footer) lines.push(footer);
  for (const button of buttons ?? []) {
    const line = flattenButton(button);
    if (line) lines.push(line);
  }
  return { text: lines.join('\n\n') };
}

export type TemplateCategory = 'AUTHENTICATION' | 'UTILITY' | 'MARKETING';

/** Dados a gravar quando a Meta reclassifica o template, ou `null` se a categoria local já é a dela. */
export function categoryChangeData(
  current: TemplateCategory,
  next: TemplateCategory | undefined,
): {
  category: TemplateCategory;
  previousCategory: TemplateCategory;
  categoryChangedAt: Date;
} | null {
  if (!next || next === current) return null;
  return {
    category: next,
    previousCategory: current,
    categoryChangedAt: new Date(),
  };
}
