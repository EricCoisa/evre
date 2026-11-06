'use client';

import React from 'react';
import { cn } from '@/lib/cn';
import { FONT_SIZE_CSS } from '@/lib/messaging/whatsapp-rich-text';

// Match template variables, code blocks, bold, italic, strikethrough
const TOKEN_RE = /\{\{[^}]*\}\}|```([^`]+)```|\*([^*]+)\*|_([^_]+)_|~([^~]+)~/g;
const FS_RE = /\[fs:([^\]]+)\](.*?)\[\/fs\]/g;

interface RichTextViewerProps {
  content?: string | null;
  className?: string;
  fallbackText?: string;
}

function renderFormattedChunk(text: string, keyPrefix: string): React.ReactNode[] {
  TOKEN_RE.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const nodes: React.ReactNode[] = [];
  let partIndex = 0;

  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <span key={`${keyPrefix}-txt-${partIndex++}`}>
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }

    if (match[1] !== undefined) {
      // Code
      nodes.push(
        <code
          key={`${keyPrefix}-code-${partIndex++}`}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {match[1]}
        </code>
      );
    } else if (match[2] !== undefined) {
      // Bold
      nodes.push(
        <strong key={`${keyPrefix}-b-${partIndex++}`} className="font-semibold text-foreground">
          {match[2]}
        </strong>
      );
    } else if (match[3] !== undefined) {
      // Italic
      nodes.push(
        <em key={`${keyPrefix}-i-${partIndex++}`} className="italic">
          {match[3]}
        </em>
      );
    } else if (match[4] !== undefined) {
      // Strikethrough
      nodes.push(
        <span key={`${keyPrefix}-s-${partIndex++}`} className="line-through text-muted-foreground">
          {match[4]}
        </span>
      );
    } else {
      nodes.push(<span key={`${keyPrefix}-var-${partIndex++}`}>{match[0]}</span>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <span key={`${keyPrefix}-end-${partIndex++}`}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  return nodes;
}

function renderLineWithFontSize(line: string, lineIndex: number): React.ReactNode[] {
  FS_RE.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const nodes: React.ReactNode[] = [];
  let chunkIndex = 0;

  while ((match = FS_RE.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        ...renderFormattedChunk(
          line.slice(lastIndex, match.index),
          `l${lineIndex}-c${chunkIndex++}`
        )
      );
    }

    const fontSizeKey = match[1];
    const innerText = match[2];
    const cssSize = FONT_SIZE_CSS[fontSizeKey];

    nodes.push(
      <span
        key={`l${lineIndex}-fs-${chunkIndex++}`}
        style={cssSize ? { fontSize: cssSize } : undefined}
      >
        {renderFormattedChunk(innerText, `l${lineIndex}-fsi-${chunkIndex}`)}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    nodes.push(
      ...renderFormattedChunk(line.slice(lastIndex), `l${lineIndex}-end`)
    );
  }

  return nodes;
}

export function RichTextViewer({
  content,
  className,
  fallbackText = '',
}: RichTextViewerProps) {
  if (!content || !content.trim()) {
    return fallbackText ? (
      <span className="text-muted-foreground italic text-xs">{fallbackText}</span>
    ) : null;
  }

  const lines = content.split('\n');

  return (
    <div className={cn('space-y-1 text-sm leading-relaxed whitespace-pre-wrap break-words', className)}>
      {lines.map((line, idx) => (
        <div key={idx} className="min-h-[1.25rem]">
          {line.length === 0 ? <br /> : renderLineWithFontSize(line, idx)}
        </div>
      ))}
    </div>
  );
}

