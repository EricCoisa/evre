'use client';

import { Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';

const formatTimer = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Barra que substitui o campo de texto enquanto a mensagem de voz é gravada. */
export function RecordingBar({
  seconds,
  busy,
  onCancel,
  onSend,
}: {
  seconds: number;
  busy: boolean;
  onCancel: () => void;
  onSend: () => void;
}) {
  const { t } = useTranslation('messaging');
  return (
    <div className="flex items-center gap-3 border-t bg-muted/40 p-2" role="status" aria-label={t('recording')}>
      <Button type="button" size="icon" variant="ghost" aria-label={t('cancelRecording')} onClick={onCancel}>
        <Trash2 />
      </Button>
      <span className="size-2.5 animate-pulse rounded-full bg-red-500" aria-hidden />
      <span className="flex-1 font-mono text-sm tabular-nums">{formatTimer(seconds)}</span>
      <Button type="button" size="icon" aria-label={t('sendVoice')} disabled={busy} onClick={onSend}>
        <Send />
      </Button>
    </div>
  );
}
