/** Faz o parse de formatação WhatsApp (negrito, itálico, riscado, monospace) com suporte a aninhamento. */

export type FormattedPart =
  | { type: 'text'; text: string }
  | { type: 'bold'; parts: FormattedPart[] }
  | { type: 'italic'; parts: FormattedPart[] }
  | { type: 'strikethrough'; parts: FormattedPart[] }
  | { type: 'code'; text: string };

/** Transforma texto com formatação WhatsApp em estrutura tipada, processando code, bold, italic e strikethrough em ordem. */
export function parseWhatsAppFormat(text: string): FormattedPart[] {
  // Code blocks: ```...``` (não permite aninhamento)
  const withCode = text.split(/(```[^`]*?```)/);

  const parts: FormattedPart[] = [];
  for (const part of withCode) {
    if (part.startsWith('```') && part.endsWith('```')) {
      const code = part.slice(3, -3).trim();
      parts.push({ type: 'code', text: code });
    } else if (part) {
      // Processar formatação em bold, italic, strikethrough
      parts.push(...parseInlineFormat(part));
    }
  }

  return parts;
}

function parseInlineFormat(text: string): FormattedPart[] {
  // Ordem importa: bold first, então italic, então strikethrough
  return parseBold(text);
}

function parseBold(text: string): FormattedPart[] {
  const parts: FormattedPart[] = [];
  const regex = /\*([^\*]+?)\*/g;
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push(...parseItalic(text.slice(lastIndex, start)));
    }
    // Recursivamente parse italic/strikethrough dentro do bold
    parts.push({
      type: 'bold',
      parts: parseItalic(match[1]),
    });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(...parseItalic(text.slice(lastIndex)));
  }

  return parts.length > 0 ? parts : [{ type: 'text', text }];
}

function parseItalic(text: string): FormattedPart[] {
  const parts: FormattedPart[] = [];
  const regex = /_([^_]+?)_/g;
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push(...parseStrikethrough(text.slice(lastIndex, start)));
    }
    parts.push({
      type: 'italic',
      parts: parseStrikethrough(match[1]),
    });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(...parseStrikethrough(text.slice(lastIndex)));
  }

  return parts.length > 0 ? parts : [{ type: 'text', text }];
}

function parseStrikethrough(text: string): FormattedPart[] {
  const parts: FormattedPart[] = [];
  const regex = /~([^~]+?)~/g;
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push({ type: 'text', text: text.slice(lastIndex, start) });
    }
    parts.push({
      type: 'strikethrough',
      parts: [{ type: 'text', text: match[1] }],
    });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', text }];
}
