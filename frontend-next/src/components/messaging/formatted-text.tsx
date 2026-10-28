'use client';

import { parseWhatsAppFormat, type FormattedPart } from '@/lib/messaging/format-whatsapp-text';
import { linkify } from '@/lib/messaging/linkify';

function renderPart(part: FormattedPart, index: number): React.ReactNode {
  switch (part.type) {
    case 'text': {
      // Aplicar linkify também em partes de texto
      return linkify(part.text).map((link, i) =>
        link.href ? (
          <a
            key={`${index}-${i}`}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 underline underline-offset-2 dark:text-sky-400"
          >
            {link.text}
          </a>
        ) : (
          <span key={`${index}-${i}`}>{link.text}</span>
        ),
      );
    }

    case 'bold':
      return (
        <strong key={index} className="font-bold">
          {part.parts.map((p, i) => renderPart(p, i))}
        </strong>
      );

    case 'italic':
      return (
        <em key={index} className="italic">
          {part.parts.map((p, i) => renderPart(p, i))}
        </em>
      );

    case 'strikethrough':
      return (
        <s key={index} className="line-through">
          {part.parts.map((p, i) => renderPart(p, i))}
        </s>
      );

    case 'code':
      return (
        <code
          key={index}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
        >
          {part.text}
        </code>
      );
  }
}

/** Renderiza texto com formatação WhatsApp (*negrito*, _itálico_, ~riscado~, ```código```). */
export function FormattedText({ text }: { text: string }) {
  const parts = parseWhatsAppFormat(text);

  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, index) => renderPart(part, index))}
    </p>
  );
}
