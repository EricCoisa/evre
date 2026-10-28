'use client';

import type { MessagingMessage } from '@/lib/actions/messaging/types';
import { FormattedText } from './formatted-text';

interface MessageTemplateRendererProps {
  message: MessagingMessage;
}

/** Renderiza uma mensagem de template com header, body, footer e botões. */
export function MessageTemplateRenderer({ message }: MessageTemplateRendererProps) {
  if (message.type !== 'TEMPLATE' || !message.templateData) {
    return null;
  }

  const { templateData } = message;

  return (
    <div className="space-y-2 text-sm">
      {templateData.header && (
        <div className="font-semibold text-muted-foreground">
          {templateData.header.kind === 'TEXT' && (
            <FormattedText text={templateData.header.text} />
          )}
        </div>
      )}

      <div>
        <FormattedText text={templateData.body} />
      </div>

      {templateData.buttons && templateData.buttons.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {templateData.buttons.map((button, idx) => {
            switch (button.kind) {
              case 'URL':
                return (
                  <a
                    key={idx}
                    href={button.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                  >
                    {button.label}
                  </a>
                );
              case 'PHONE_NUMBER':
                return (
                  <a
                    key={idx}
                    href={`tel:${button.phoneNumber}`}
                    className="inline-flex items-center rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
                  >
                    {button.label}
                  </a>
                );
              case 'QUICK_REPLY':
              case 'COPY_CODE':
                return (
                  <div
                    key={idx}
                    className="inline-flex items-center rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {button.label}
                  </div>
                );
            }
          })}
        </div>
      )}

      {templateData.footer && (
        <div className="text-xs text-muted-foreground/70 pt-1">
          <FormattedText text={templateData.footer} />
        </div>
      )}
    </div>
  );
}
