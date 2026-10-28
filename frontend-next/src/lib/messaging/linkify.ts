export type TextPart = { text: string; href?: string };

const URL_PATTERN = /\b(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/gi;

/** Quebra o texto em trechos, marcando as URLs http(s) — sem `dangerouslySetInnerHTML`. */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: match[0], href: match[0] });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
