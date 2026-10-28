'use client';

import { useState } from 'react';
import { Bell, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/hooks/use-translation';
import { useMe } from '@/lib/actions/auth/queries';
import {
  useUnreadCount,
  useMyNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDismissNotification,
} from '@/lib/actions/notification/queries';
import { NotificationItem } from '@/components/notification/renderer-registry';
import { SendNotificationModal } from '@/components/notification/send-notification-modal';

/** Só monta quando o layout (RSC) decide que NOTIFICATION está ligada — ver (private)/layout.tsx. */
function BellBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <Badge
      variant="destructive"
      className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none"
    >
      {count > 99 ? '99+' : count}
    </Badge>
  );
}

function BellHeaderActions({
  isAdmin,
  hasUnread,
  onCompose,
  onMarkAllRead,
  t,
}: {
  isAdmin: boolean;
  hasUnread: boolean;
  onCompose: () => void;
  onMarkAllRead: () => void;
  t: (key: string) => string;
}) {
  if (!isAdmin && !hasUnread) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={onCompose}
        >
          <Send className="size-3" />
          {t('send_broadcast_action')}
        </Button>
      )}
      {hasUnread && (
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={onMarkAllRead}
        >
          {t('mark_all_read')}
        </Button>
      )}
    </div>
  );
}

export function NotificationBell() {
  const { t } = useTranslation('notification');
  const { data: user } = useMe();
  const { data: unreadCount } = useUnreadCount();
  const { data: page } = useMyNotifications({ limit: 10 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const dismiss = useDismissNotification();
  const [composerOpen, setComposerOpen] = useState(false);

  const hasUnread = !!unreadCount;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative size-8">
            <Bell className="size-4" />
            <BellBadge count={unreadCount} />
            <span className="sr-only">{t('bell_label')}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex flex-col gap-1.5 px-3 py-2 border-b">
            <span className="text-sm font-medium">{t('bell_label')}</span>
            <BellHeaderActions
              isAdmin={isAdmin}
              hasUnread={hasUnread}
              onCompose={() => setComposerOpen(true)}
              onMarkAllRead={() => markAllRead.mutate()}
              t={t}
            />
          </div>
          <ScrollArea className="max-h-96">
            <div className="flex flex-col gap-1 p-2">
              {(page?.data.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">{t('empty')}</p>
              )}
              {page?.data.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={() => markRead.mutate(notification.id)}
                  onDismiss={() => dismiss.mutate(notification.id)}
                />
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {isAdmin && <SendNotificationModal open={composerOpen} onOpenChange={setComposerOpen} />}
    </>
  );
}
