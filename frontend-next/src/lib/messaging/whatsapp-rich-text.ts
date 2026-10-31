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

/** Tailwind class → CSS value, for font-size inline styles stored on TextNodes. */
export const FONT_SIZE_CSS: Record<string, string> = {
  'text-xs': '0.75rem',
  'text-sm': '0.875rem',
  'text-base': '1rem',
  'text-lg': '1.125rem',
  'text-xl': '1.25rem',
  'text-2xl': '1.5rem',
};

const CSS_TO_TW: Record<string, string> = Object.fromEntries(
  Object.entries(FONT_SIZE_CSS).map(([tw, css]) => [css, tw]),
);

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
    let currentTwClass: string | undefined = undefined;
    let currentBuffer = '';

    const flush = () => {
      if (!currentBuffer) return;
      if (currentTwClass) {
        line += `[fs:${currentTwClass}]${currentBuffer}[/fs]`;
      } else {
        line += currentBuffer;
      }
      currentBuffer = '';
      currentTwClass = undefined;
    };

    for (const child of paragraph.getChildren()) {
      if ($isLineBreakNode(child)) {
        flush();
        line += '\n';
        continue;
      }
      if (!$isTextNode(child)) continue;
      const format = FORMAT_TAGS.find((item) => child.hasFormat(item.format))?.format ?? null;
      const serialized = serializeWhatsAppText(child.getTextContent(), format);
      const fontSizeMatch = /font-size:\s*([^;]+)/.exec(child.getStyle());
      const twClass = fontSizeMatch ? CSS_TO_TW[fontSizeMatch[1].trim()] : undefined;

      if (twClass !== currentTwClass) {
        flush();
        currentTwClass = twClass;
      }
      currentBuffer += serialized;
    }
    flush();
    lines.push(line);
  }
  return lines.join('\n');
}

// Match template variables first so snake_case names are not parsed as italic formatting.
const TOKEN_RE = /\{\{[^}]*\}\}|```([^`]+)```|\*([^*]+)\*|_([^_]+)_|~([^~]+)~/g;
// Font-size markers emitted by exportWhatsAppText.
const FS_RE = /\[fs:([^\]]+)\](.*?)\[\/fs\]/g;

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

function appendFormattedNodes(
  parent: ReturnType<typeof $createParagraphNode>,
  text: string,
  fontSizeCss?: string,
) {
  TOKEN_RE.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const node = $createTextNode(text.slice(lastIndex, match.index));
      if (fontSizeCss) node.setStyle(`font-size: ${fontSizeCss}`);
      parent.append(node);
    }
    const node = createFormattedNode(match);
    if (fontSizeCss) node.setStyle(`font-size: ${fontSizeCss}`);
    parent.append(node);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    const node = $createTextNode(text.slice(lastIndex));
    if (fontSizeCss) node.setStyle(`font-size: ${fontSizeCss}`);
    parent.append(node);
  }
}

function parseWhatsAppLine(line: string) {
  const paragraph = $createParagraphNode();
  FS_RE.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FS_RE.exec(line)) !== null) {
    if (match.index > lastIndex) {
      appendFormattedNodes(paragraph, line.slice(lastIndex, match.index));
    }
    appendFormattedNodes(paragraph, match[2], FONT_SIZE_CSS[match[1]]);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    appendFormattedNodes(paragraph, line.slice(lastIndex));
  }
  if (paragraph.getChildrenSize() === 0) {
    paragraph.append($createTextNode(''));
  }
  $getRoot().append(paragraph);
}

export function importWhatsAppText(text: string) {
  TOKEN_RE.lastIndex = 0;
  $getRoot().clear();
  for (const line of text.length > 0 ? text.split('\n') : ['']) parseWhatsAppLine(line);
}
