import type {
  TemplateButton,
  TemplateHeader,
} from 'src/domain/interface/messaging-provider.interface';
import { extractPlaceholders } from './template.util';

/** Regras que a Meta aplica na revisão de templates, checadas sem ir à rede na submissão e no editor. */
export type MetaIssueSeverity = 'error' | 'warning';
export type MetaIssueField =
  'body' | 'header' | 'footer' | 'buttons' | 'template';

export interface MetaTemplateIssue {
  code: string;
  severity: MetaIssueSeverity;
  field: MetaIssueField;
  message: string;
  params?: Record<string, string | number>;
}

export interface MetaRuleContent {
  category: string;
  body: string;
  header?: TemplateHeader | null;
  footer?: string | null;
  buttons?: readonly TemplateButton[] | null;
}

/** Encurtadores de URL: a Meta recusa template com link encurtado (o destino real fica oculto). */
export const URL_SHORTENER_HOSTS = [
  'bit.ly',
  'bitly.com',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'rebrand.ly',
  'cutt.ly',
  'shorturl.at',
  'tiny.cc',
  'rb.gy',
] as const;

const PLACEHOLDER = '\\{\\{\\s*[a-zA-Z0-9_.]+\\s*\\}\\}';
const STARTS_WITH_VARIABLE = new RegExp(`^\\s*${PLACEHOLDER}`);
const ENDS_WITH_VARIABLE = new RegExp(`${PLACEHOLDER}\\s*$`);
const ADJACENT_VARIABLES = new RegExp(`${PLACEHOLDER}${PLACEHOLDER}`);
const URL_RE = /https?:\/\/[^\s)>\]"']+/gi;

/** Quantas palavras fixas (fora das variáveis) o texto tem. */
function fixedWords(text: string): number {
  return text
    .replace(new RegExp(PLACEHOLDER, 'g'), ' ')
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

function shortenerIn(text: string): string | null {
  for (const url of text.match(URL_RE) ?? []) {
    try {
      const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      const hit = URL_SHORTENER_HOSTS.find((s) => host === s);
      if (hit) return hit;
    } catch {
      // URL ainda incompleta no editor: ignora.
    }
  }
  return null;
}

export function checkMetaTemplateRules(
  content: MetaRuleContent,
): MetaTemplateIssue[] {
  if (content.category === 'AUTHENTICATION') return [];

  const issues: MetaTemplateIssue[] = [];
  const add = (issue: MetaTemplateIssue) => issues.push(issue);
  const body = content.body ?? '';
  const variables = extractPlaceholders(body);

  // --- Corpo ---------------------------------------------------------------------------------
  if (STARTS_WITH_VARIABLE.test(body)) {
    add({
      code: 'BODY_STARTS_WITH_VARIABLE',
      severity: 'error',
      field: 'body',
      message:
        'O corpo não pode começar com uma variável: escreva um texto antes dela (ex.: "Olá, {{ nome }}").',
    });
  }
  if (ENDS_WITH_VARIABLE.test(body)) {
    add({
      code: 'BODY_ENDS_WITH_VARIABLE',
      severity: 'error',
      field: 'body',
      message:
        'O corpo não pode terminar com uma variável: acrescente um texto depois dela (ex.: um ponto final ou uma frase).',
    });
  }
  if (ADJACENT_VARIABLES.test(body)) {
    add({
      code: 'BODY_ADJACENT_VARIABLES',
      severity: 'error',
      field: 'body',
      message:
        'Duas variáveis não podem ficar coladas ({{ a }}{{ b }}): separe-as com texto.',
    });
  }
  if (/(\r?\n){4,}/.test(body)) {
    add({
      code: 'BODY_TOO_MANY_LINE_BREAKS',
      severity: 'warning',
      field: 'body',
      message:
        'Muitas quebras de linha seguidas costumam ser recusadas pela Meta: use no máximo uma linha em branco.',
    });
  }
  if (variables.length > 0) {
    const words = fixedWords(body);
    if (words < variables.length * 2) {
      add({
        code: 'BODY_TOO_MANY_VARIABLES',
        severity: 'warning',
        field: 'body',
        message:
          'Há poucas palavras fixas para a quantidade de variáveis; a Meta recusa texto dominado por variáveis. Escreva mais texto ou use menos variáveis.',
        params: { words, variables: variables.length },
      });
    }
  } else if (content.category === 'UTILITY') {
    add({
      code: 'UTILITY_WITHOUT_VARIABLES',
      severity: 'warning',
      field: 'body',
      message:
        'Template de Utilidade sem nenhuma variável parece genérico e costuma ser reclassificado como Marketing (cobrança diferente).',
    });
  }

  // --- Rodapé --------------------------------------------------------------------------------
  if (content.footer && extractPlaceholders(content.footer).length > 0) {
    add({
      code: 'FOOTER_HAS_VARIABLE',
      severity: 'error',
      field: 'footer',
      message:
        'O rodapé não aceita variáveis: tire a variável ou mova o texto para o corpo.',
    });
  }

  // --- Links ---------------------------------------------------------------------------------
  const linkTexts: [MetaIssueField, string][] = [
    ['body', body],
    ['header', content.header?.kind === 'TEXT' ? content.header.text : ''],
    ['footer', content.footer ?? ''],
    ...(content.buttons ?? []).map((b): [MetaIssueField, string] => [
      'buttons',
      b.kind === 'URL' ? b.url : '',
    ]),
  ];
  for (const [field, text] of linkTexts) {
    const host = shortenerIn(text);
    if (host) {
      add({
        code: 'URL_SHORTENER',
        severity: 'error',
        field,
        message: `Link encurtado (${host}) é recusado pela Meta: use o endereço completo do seu domínio.`,
        params: { host },
      });
      break;
    }
  }

  // --- Botões --------------------------------------------------------------------------------
  const phone = (content.buttons ?? []).find(
    (b) => b.kind === 'PHONE_NUMBER' && !b.phoneNumber.trim().startsWith('+'),
  );
  if (phone) {
    add({
      code: 'PHONE_WITHOUT_COUNTRY_CODE',
      severity: 'warning',
      field: 'buttons',
      message:
        'O telefone do botão deve começar com + e o código do país (ex.: +55 11 99999-9999).',
    });
  }

  return issues;
}

/** Só os que barram a submissão. */
export const metaErrors = (issues: readonly MetaTemplateIssue[]) =>
  issues.filter((issue) => issue.severity === 'error');
