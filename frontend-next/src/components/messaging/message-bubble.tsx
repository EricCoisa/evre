'use client';

import { FileText } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/hooks/use-translation';
import type { MessagingMessage } from '@/lib/actions/messaging/types';
import { isMediaMessage } from '@/lib/messaging/media';
import { FormattedText } from './formatted-text';
import { MessageTemplateRenderer } from './message-template-renderer';
import { MessageMedia } from './message-media';
import { MessageStatus } from './message-status';

/** Texto/legenda da mensagem, ou o aviso de tipo que o painel não sabe exibir. */
function MessageBody({ message, padded }: { message: MessagingMessage; padded: boolean }) {
  const { t } = useTranslation('messaging');

  if (message.type === 'TEMPLATE') {
    return (
      <div className={cn(padded && 'px-1', 'space-y-2')}>
        <MessageTemplateRenderer message={message} />
      </div>
    );
  }

  if (message.type === 'UNSUPPORTED') {
    return <p className="italic text-muted-foreground">{t('unsupportedMessage')}</p>;
  }

  if (!message.text) return null;

  return (
    <div className={cn(padded && 'px-1')}>
      <FormattedText text={message.text} />
    </div>
  );
}

function getBubbleVariantClass(isSticker: boolean, outgoing: boolean): string {
  if (isSticker) return 'bg-transparent shadow-none';
  if (outgoing) return 'bg-emerald-100 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-50';
  return 'border bg-card';
}

export function MessageBubble({
  message,
  startsRun,
  locale,
}: {
  message: MessagingMessage;
  startsRun: boolean;
  locale: string;
}) {
  const outgoing = message.direction === 'OUTBOUND';
  const hasMedia = isMediaMessage(message.type);
  const isSticker = message.type === 'STICKER';
  const isTemplate = message.type === 'TEMPLATE';
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(message.createdAt),
  );

  return (
    <div
      className={cn('flex', outgoing ? 'justify-end' : 'justify-start', startsRun ? 'mt-3' : 'mt-0.5')}
      data-direction={message.direction}
    >
      <article
        className={cn(
          'flex max-w-[84%] min-w-20 flex-col gap-1 rounded-lg px-2.5 py-1.5 text-sm shadow-sm',
          hasMedia && 'p-1.5',
          getBubbleVariantClass(isSticker, outgoing),
        )}
      >
        {isTemplate && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="size-3.5 flex-shrink-0" />
            <span>Template</span>
          </div>
        )}
        {hasMedia && <MessageMedia message={message} />}
        <MessageBody message={message} padded={hasMedia} />
        {message.status === 'FAILED' && message.error && (
          <p role="alert" className="px-1 text-xs text-destructive">
            {message.error}
          </p>
        )}

        <div className="flex items-center justify-end gap-1 px-1 text-[10px] text-muted-foreground">
          <time dateTime={message.createdAt}>{time}</time>
          {outgoing && <MessageStatus status={message.status} />}
        </div>
      </article>
    </div>
  );
}
