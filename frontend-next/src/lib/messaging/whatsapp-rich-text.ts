import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  $isLineBreakNode,
  $isTextNode,
  type TextFormatType,
} from 'lexical';

// Keep the WhatsApp provider syntax instead of CommonMark; underscores inside variables stay literal.
const FORMAT_TAGS: { format: TextFormatType; tag: string }[] = [
  { format: 'code', tag: '```' },
  { format: 'bold', tag: '*' },
  { format: 'italic', tag: '_' },
  { format: 'strikethrough', tag: '~' },
];

export function serializeWhatsAppText(text: string, format: TextFormatType | null): string {
  const tag = FORMAT_TAGS.find((item) => item.format === format)?.tag;
  if (!tag) return text;
  return text.replace(/\S+/gu, (word) => `${tag}${word}${tag}`);
}

export function exportWhatsAppText(): string {
  const lines: string[] = [];
  for (const paragraph of $getRoot().getChildren()) {
    if (!$isElementNode(paragraph)) continue;
    let line = '';
    for (const child of paragraph.getChildren()) {
      if ($isLineBreakNode(child)) {
        line += '\n';
        continue;
      }
      if (!$isTextNode(child)) continue;
      const format = FORMAT_TAGS.find((item) => child.hasFormat(item.format))?.format ?? null;
      line += serializeWhatsAppText(child.getTextContent(), format);
    }
    lines.push(line);
  }
  return lines.join('\n');
}

// Match template variables first so snake_case names are not parsed as italic formatting.
const TOKEN_RE = /\{\{[^}]*\}\}|```([^`]+)```|\*([^*]+)\*|_([^_]+)_|~([^~]+)~/g;

const MATCH_FORMATS: readonly { index: number; format: TextFormatType }[] = [
  { index: 1, format: 'code' },
  { index: 2, format: 'bold' },
  { index: 3, format: 'italic' },
  { index: 4, format: 'strikethrough' },
];

function getMatchedFormat(match: RegExpExecArray) {
  for (const { index, format } of MATCH_FORMATS) {
    const text = match[index];
    if (text !== undefined) {
      return { text, format };
    }
  }
  return null;
}

function createFormattedNode(match: RegExpExecArray) {
  const matched = getMatchedFormat(match);
  if (!matched) {
    return $createTextNode(match[0]);
  }
  const node = $createTextNode(matched.text);
  node.setFormat(matched.format);
  return node;
}

function parseWhatsAppLine(line: string) {
  const paragraph = $createParagraphNode();
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(line))) {
    if (match.index > lastIndex) {
      paragraph.append($createTextNode(line.slice(lastIndex, match.index)));
    }
    paragraph.append(createFormattedNode(match));
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length || paragraph.getChildrenSize() === 0) {
    paragraph.append($createTextNode(line.slice(lastIndex)));
  }
  $getRoot().append(paragraph);
}

export function importWhatsAppText(text: string) {
  TOKEN_RE.lastIndex = 0;
  $getRoot().clear();
  for (const line of text.length > 0 ? text.split('\n') : ['']) parseWhatsAppLine(line);
}
