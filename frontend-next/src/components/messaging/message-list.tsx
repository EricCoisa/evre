'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { useMessageThread } from '@/lib/actions/messaging/queries';
import { buildThread, formatDayLabel } from '@/lib/messaging/group-messages';
import { MessageBubble } from './message-bubble';

/** Distância do fim, em px, até a qual a conversa ainda conta como "no fim" e acompanha mensagens novas. */
const BOTTOM_THRESHOLD = 80;
/** Distância do topo que dispara o carregamento das mensagens mais antigas. */
const TOP_THRESHOLD = 120;

export function MessageList({
  connectionId,
  phone,
  scrollSignal,
}: {
  connectionId: string;
  phone: string;
  scrollSignal: number;
}) {
  const { t, locale } = useTranslation('messaging');
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessageThread(connectionId, phone);

  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const heightBeforePrepend = useRef<number | null>(null);
  const lastKey = useRef<string | null>(null);
  const handledSignal = useRef(scrollSignal);
  const [away, setAway] = useState(false);

  const items = useMemo(() => buildThread(data?.pages.flatMap((page) => page.data) ?? []), [data]);
  const newestKey = [...items].reverse().find((item) => item.kind === 'message')?.key ?? null;

  const scrollToBottom = () => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Ancoragem do scroll: ao entrar mensagens antigas no topo, mantém o que o usuário estava lendo;
  // ao entrar uma nova no fim, acompanha só se ele já estava no fim. Enviar também o leva ao fim, e
  // dali em diante a mensagem enviada (que chega no próximo refetch) é acompanhada.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;

    if (heightBeforePrepend.current !== null) {
      el.scrollTop += el.scrollHeight - heightBeforePrepend.current;
      heightBeforePrepend.current = null;
      return;
    }

    const isFirstRender = lastKey.current === null;
    const hasNew = newestKey !== lastKey.current;
    const sentNow = scrollSignal !== handledSignal.current;
    handledSignal.current = scrollSignal;
    lastKey.current = newestKey;

    if (isFirstRender || sentNow || (hasNew && stickToBottom.current)) {
      stickToBottom.current = true;
      scrollToBottom();
    }
  }, [items, newestKey, scrollSignal]);

  // Imagens e vídeos mudam a altura depois de carregar; quem está no fim continua no fim.
  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !content.current) return;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) scrollToBottom();
    });
    observer.observe(content.current);
    return () => observer.disconnect();
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
    stickToBottom.current = atBottom;
    setAway(!atBottom);

    if (el.scrollTop < TOP_THRESHOLD && hasNextPage && !isFetchingNextPage) {
      heightBeforePrepend.current = el.scrollHeight;
      void fetchNextPage();
    }
  };

  const now = new Date();
  const dayLabels = { today: t('today'), yesterday: t('yesterday') };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="h-full overflow-y-auto bg-muted/30 px-3 py-3"
        data-testid="message-scroller"
      >
        <div ref={content}>
          {isFetchingNextPage && (
            <div className="flex justify-center py-2" role="status" aria-label={t('loadingOlder')}>
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {isPending && <p className="py-6 text-center text-sm text-muted-foreground">{t('loadingMessages')}</p>}
          {isError && (
            <div className="flex flex-col items-center gap-2 py-6 text-sm text-destructive">
              <span>{t('messagesFailed')}</span>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                {t('retry')}
              </Button>
            </div>
          )}
          {!isPending && !isError && items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('emptyThread')}</p>
          )}

          {items.map((item) =>
            item.kind === 'day' ? (
              <div key={item.key} className="sticky top-0 z-10 my-3 flex justify-center">
                <span className="rounded-md bg-background/90 px-2.5 py-1 text-xs text-muted-foreground shadow-sm">
                  {formatDayLabel(item.date, now, locale, dayLabels)}
                </span>
              </div>
            ) : (
              <MessageBubble key={item.key} message={item.message} startsRun={item.startsRun} locale={locale} />
            ),
          )}
        </div>
      </div>

      {away && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label={t('jumpToBottom')}
          className="absolute right-4 bottom-3 rounded-full shadow-md"
          onClick={() => {
            stickToBottom.current = true;
            scrollToBottom();
          }}
        >
          <ArrowDown />
        </Button>
      )}
    </div>
  );
}
