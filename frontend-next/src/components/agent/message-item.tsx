"use client";

import { memo } from 'react';
import { RotateCcw, Pencil } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

// Sem horário na bolha: o backend não devolve timestamp por mensagem.
interface MessageItemProps {
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
  };
  streaming?: boolean;
  /** Último turno não completou — refaz ele (rebobina até aqui e reenvia igual). */
  onRetry?: () => void;
  /** Descarta daqui pra frente e devolve o texto para a caixa, para edição. */
  onRewind?: () => void;
}

const MessageItem = ({ message, streaming = false, onRetry, onRewind }: MessageItemProps) => {
  const { t } = useTranslation('agent');

  if (message.role === 'user') {
    return (
      <div className="group/message ml-auto flex max-w-[80%] flex-col items-end gap-1">
        <div className="rounded-lg bg-primary px-3 py-2 text-primary-foreground">
          <p className="select-text whitespace-pre-wrap break-words text-sm selection:bg-background selection:text-foreground">{message.content}</p>
        </div>
        {onRetry && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-xs text-muted-foreground"
            onClick={onRetry}
            title={t('retry')}
          >
            <RotateCcw className="size-3" />
            {t('retry')}
          </Button>
        )}
        {onRewind && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-xs text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover/message:opacity-100"
            onClick={onRewind}
            title={t('rewindHereHint')}
          >
            <Pencil className="size-3" />
            {t('rewindHere')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="mr-auto max-w-[80%] rounded-lg bg-muted px-3 py-2">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{t('assistant')}</Badge>
      </div>
      <div
        className={cn(
          'select-text whitespace-pre-wrap break-words text-sm',
          streaming && 'after:ml-0.5 after:animate-pulse after:content-["▋"]',
        )}
      >
        {message.content}
      </div>
    </div>
  );
};

export default memo(MessageItem);
