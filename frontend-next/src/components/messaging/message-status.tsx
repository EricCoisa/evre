import { AlertCircle, Check, CheckCheck, Clock3 } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import type { MessagingMessage } from '@/lib/actions/messaging/types';

/** Ticks de entrega, como no WhatsApp: relógio, ✓, ✓✓ e ✓✓ azul. */
export function MessageStatus({ status }: { status: MessagingMessage['status'] }) {
  const { t } = useTranslation('messaging');
  const label = t(`status.${status}`);
  const common = { 'aria-label': label, role: 'img' } as const;

  switch (status) {
    case 'READ':
      return <CheckCheck {...common} className="size-3.5 text-sky-500" />;
    case 'DELIVERED':
      return <CheckCheck {...common} className="size-3.5" />;
    case 'SENT':
      return <Check {...common} className="size-3.5" />;
    case 'QUEUED':
      return <Clock3 {...common} className="size-3" />;
    default:
      return <AlertCircle {...common} className="size-3.5 text-destructive" />;
  }
}
