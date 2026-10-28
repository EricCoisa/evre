'use client';

import { useState } from 'react';
import { Download, FileText, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/use-translation';
import type { MessagingMessage } from '@/lib/actions/messaging/types';
import { messageMediaSrc } from '@/lib/messaging/media';

function MediaUnavailable({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('messaging');
  return (
    <div className="flex items-center gap-2 rounded-md bg-black/5 px-3 py-2 text-xs text-muted-foreground dark:bg-white/5">
      <ImageOff className="size-4 shrink-0" aria-hidden />
      <span>{t('mediaUnavailable')}</span>
      <Button type="button" size="sm" variant="ghost" className="h-6 px-2" onClick={onRetry}>
        {t('retry')}
      </Button>
    </div>
  );
}

function ImageMedia({ src, caption, onError }: { src: string; caption: string | null | undefined; onError: () => void }) {
  const { t } = useTranslation('messaging');
  const [zoomed, setZoomed] = useState(false);
  const alt = caption ?? t('image');
  return (
    <>
      <button
        type="button"
        className="block cursor-zoom-in overflow-hidden rounded-md"
        onClick={() => setZoomed(true)}
        aria-label={t('openImage')}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- origem é o proxy autenticado; o otimizador do Next não alcança */}
        <img src={src} alt={alt} loading="lazy" onError={onError} className="max-h-72 min-h-24 min-w-40 max-w-full object-cover" />
      </button>
      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent className="max-w-4xl bg-black/90 p-2">
          <DialogTitle className="sr-only">{t('image')}</DialogTitle>
          <DialogDescription className="sr-only">{caption ?? ''}</DialogDescription>
          {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
          <img src={src} alt={alt} className="max-h-[80vh] w-full object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}

function DocumentMedia({ src, fileName }: { src: string; fileName: string | null | undefined }) {
  const { t } = useTranslation('messaging');
  return (
    <a
      href={src}
      download={fileName ?? true}
      className="flex items-center gap-3 rounded-md bg-black/5 px-3 py-2 text-sm hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
    >
      <FileText className="size-8 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{fileName ?? t('document')}</span>
      <Download className="size-4 shrink-0 text-muted-foreground" aria-label={t('download')} />
    </a>
  );
}

/** Exibe a mídia de uma mensagem servida pelo proxy, tratando o caso de o arquivo não existir mais. */
export function MessageMedia({ message }: { message: MessagingMessage }) {
  const { t } = useTranslation('messaging');
  const src = messageMediaSrc(message);
  // `attempt` remonta o elemento: é o único jeito de o <img>/<audio> tentar de novo depois de um erro.
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <MediaUnavailable
        onRetry={() => {
          setFailed(false);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  const onError = () => setFailed(true);

  switch (message.type) {
    case 'IMAGE':
      return <ImageMedia key={attempt} src={src} caption={message.text} onError={onError} />;
    case 'STICKER':
      // eslint-disable-next-line @next/next/no-img-element -- idem
      return <img key={attempt} src={src} alt={t('sticker')} loading="lazy" onError={onError} className="size-32 object-contain" />;
    case 'VIDEO':
      return <video key={attempt} src={src} controls playsInline preload="metadata" onError={onError} className="max-h-72 max-w-full rounded-md bg-black" />;
    case 'AUDIO':
      return <audio key={attempt} src={src} controls preload="metadata" onError={onError} className="h-10 w-64 max-w-full" />;
    default:
      return <DocumentMedia src={src} fileName={message.fileName} />;
  }
}
