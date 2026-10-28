'use client';

import { useState, useSyncExternalStore } from 'react';
import { Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTranslation, type TFunc } from '@/hooks/use-translation';
import { useTypingIndicator } from '@/hooks/use-typing-indicator';
import {
  useMessagingCapabilities,
  useMessagingConversations,
  useMessagingHealth,
} from '@/lib/actions/messaging/queries';
import { MessageComposer, toAttachment, type Attachment } from './message-composer';
import { MessageList } from './message-list';

const HOUR_MS = 60 * 60 * 1000;

/** `Date.now()` é impuro; `useSyncExternalStore` é a forma correta de ler essa hora durante o render. */
function useIsPastDeadline(deadline: number | null): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (deadline === null) return () => undefined;
      const delay = deadline - Date.now();
      if (delay <= 0) return () => undefined;
      const timer = setTimeout(onChange, delay);
      return () => clearTimeout(timer);
    },
    () => deadline !== null && Date.now() >= deadline,
  );
}

function useServiceWindowStatus({
  conversations,
  connectionId,
  capabilities,
}: {
  conversations: ReturnType<typeof useMessagingConversations>;
  connectionId: string;
  capabilities: ReturnType<typeof useMessagingCapabilities>;
}) {
  const thisConversation = conversations.data?.find((c) => c.connectionId === connectionId);
  const lastInboundAt = thisConversation?.lastInboundAt
    ? new Date(thisConversation.lastInboundAt).getTime()
    : null;
  const windowHours = capabilities.data?.serviceWindowHours ?? null;
  const deadline =
    windowHours !== null && lastInboundAt !== null ? lastInboundAt + windowHours * HOUR_MS : null;
  const pastDeadline = useIsPastDeadline(deadline);
  const outsideServiceWindow = windowHours !== null && (lastInboundAt === null || pastDeadline);

  return { windowHours, outsideServiceWindow };
}

function ThreadHeader({
  phone,
  operational,
  t,
}: {
  phone: string;
  operational: boolean;
  t: TFunc;
}) {
  return (
    <div className="flex items-center justify-between border-b px-3 py-2 text-xs">
      <span className="truncate font-mono text-muted-foreground">{phone}</span>
      <span className={operational ? 'text-emerald-700' : 'text-destructive'}>
        {operational ? t('connected') : t('unavailable')}
      </span>
    </div>
  );
}

function ThreadStatusAlerts({
  health,
  outsideServiceWindow,
  windowHours,
  typing,
  capabilities,
  t,
}: {
  health: ReturnType<typeof useMessagingHealth>;
  outsideServiceWindow: boolean;
  windowHours: number | null;
  typing: string | null;
  capabilities: ReturnType<typeof useMessagingCapabilities>;
  t: TFunc;
}) {
  return (
    <>
      {!health.operational && (
        <div className="border-t bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {health.reason || t('providerUnavailable')}
        </div>
      )}

      {outsideServiceWindow && (
        <div className="border-t bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {t('outsideServiceWindow', { hours: windowHours ?? 0 })}
        </div>
      )}

      {typing && (
        <div className="border-t px-3 py-1 text-xs text-muted-foreground">
          {typing === 'RECORDING' ? t('typingRecording') : t('typingComposing')}
        </div>
      )}

      {capabilities.isError && (
        <div role="alert" className="flex items-center justify-between gap-3 border-t px-3 py-2 text-xs text-destructive">
          <span>{t('capabilitiesFailed')}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void capabilities.refetch()}>
            {t('retry')}
          </Button>
        </div>
      )}
    </>
  );
}

/** Conversa com um telefone: cabeçalho, histórico, e o campo de envio (texto, anexo, voz, template). */
export function MessageThread({ connectionId, phone }: { connectionId: string; phone: string }) {
  const { t } = useTranslation('messaging');
  const capabilities = useMessagingCapabilities(connectionId);
  const health = useMessagingHealth(connectionId);
  const conversations = useMessagingConversations(phone);
  const typing = useTypingIndicator(connectionId, phone);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const { windowHours, outsideServiceWindow } = useServiceWindowStatus({
    conversations,
    connectionId,
    capabilities,
  });
  const canAttach = health.operational && Boolean(capabilities.data) && !outsideServiceWindow;

  const onDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!canAttach) return;
    const next = toAttachment(event.dataTransfer.files[0], false, () => toast.error(t('fileTooLarge')));
    if (next) setAttachment(next);
  };

  return (
    <section
      className="relative flex h-full min-h-0 flex-col bg-background"
      aria-label={t('threadTitle')}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <ThreadHeader phone={phone} operational={health.operational} t={t} />

      <MessageList connectionId={connectionId} phone={phone} scrollSignal={sentCount} />

      <ThreadStatusAlerts
        health={health}
        outsideServiceWindow={outsideServiceWindow}
        windowHours={windowHours}
        typing={typing}
        capabilities={capabilities}
        t={t}
      />

      <MessageComposer
        connectionId={connectionId}
        phone={phone}
        capabilities={capabilities.data}
        operational={health.operational}
        attachment={attachment}
        onAttachmentChange={setAttachment}
        onSent={() => setSentCount((count) => count + 1)}
        outsideServiceWindow={outsideServiceWindow}
      />

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/85 text-sm text-muted-foreground">
          <Paperclip className="size-8" aria-hidden />
          {t('dropToAttach')}
        </div>
      )}
    </section>
  );
}
