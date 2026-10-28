'use client';

import type { ComponentType } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import type { Notification } from '@/lib/actions/notification/types';

export interface NotificationRendererProps {
  notification: Notification;
  onMarkRead: () => void;
  onDismiss: () => void;
}

/** Mapa de tipo de notificação para componente customizado; sem entrada, usa o renderer padrão. */
const NOTIFICATION_RENDERERS: Record<string, ComponentType<NotificationRendererProps>> = {};

export function NotificationItem(props: NotificationRendererProps) {
  const Renderer = NOTIFICATION_RENDERERS[props.notification.type] ?? DefaultNotificationRenderer;
  return <Renderer {...props} />;
}

function DefaultNotificationRenderer({ notification, onMarkRead, onDismiss }: NotificationRendererProps) {
  const { locale } = useTranslation('notification');
  const dateLocale = locale?.startsWith('pt') ? ptBR : enUS;
  const isUnread = !notification.readAt;

  return (
    <div
      className={`group flex items-start gap-2 rounded-md p-2 ${isUnread ? 'bg-accent/50' : ''}`}
      onClick={isUnread ? onMarkRead : undefined}
      role={isUnread ? 'button' : undefined}
    >
      <div className="flex-1 min-w-0">
        {notification.title && <p className="text-sm font-medium truncate">{notification.title}</p>}
        {notification.message && (
          <p className="text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: dateLocale })}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
