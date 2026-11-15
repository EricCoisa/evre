'use client';

import type { ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import type { Notification } from '@/lib/actions/notification/types';
import { MilestoneApprovalRequestedRenderer } from './notification-approval-requested-renderer';

export interface NotificationRendererProps {
  notification: Notification;
  onMarkRead: () => void;
  onDismiss: () => void;
}

/** Mapa de tipo de notificação para componente customizado; sem entrada, usa o renderer padrão. */
const NOTIFICATION_RENDERERS: Record<string, ComponentType<NotificationRendererProps>> = {
  PROJECT_MILESTONE_APPROVAL_REQUESTED: MilestoneApprovalRequestedRenderer,
};

export function NotificationItem(props: NotificationRendererProps) {
  const Renderer = NOTIFICATION_RENDERERS[props.notification.type] ?? DefaultNotificationRenderer;
  return <Renderer {...props} />;
}

export interface DefaultNotificationRendererProps extends NotificationRendererProps {
  extraAction?: { label: string; onClick: () => void };
}

function NotificationActionButton({
  notification,
  extraAction,
  isUnread,
  onMarkRead,
  t,
  router,
}: {
  notification: Notification;
  extraAction?: { label: string; onClick: () => void };
  isUnread: boolean;
  onMarkRead: () => void;
  t: (key: string) => string;
  router: ReturnType<typeof useRouter>;
}) {
  if (extraAction) {
    return (
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs text-primary"
        onClick={(e) => { e.stopPropagation(); extraAction.onClick(); }}
      >
        {extraAction.label}
      </Button>
    );
  }
  if (!notification.actionUrl) return null;
  return (
    <Button
      variant="link"
      size="sm"
      className="h-auto p-0 text-xs"
      onClick={(e) => {
        e.stopPropagation();
        if (isUnread) onMarkRead();
        router.push(notification.actionUrl!);
      }}
    >
      <ExternalLink className="size-3 mr-1" />
      {t('action_open')}
    </Button>
  );
}

export function DefaultNotificationRenderer({ notification, onMarkRead, onDismiss, extraAction }: DefaultNotificationRendererProps) {
  const { locale, t } = useTranslation('notification');
  const router = useRouter();
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
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: dateLocale })}
          </p>
          <NotificationActionButton
            notification={notification}
            extraAction={extraAction}
            isUnread={isUnread}
            onMarkRead={onMarkRead}
            t={t}
            router={router}
          />
        </div>
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
