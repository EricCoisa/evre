import type {
  NotificationDto,
  NotificationControllerFindMine200Meta,
  SendBroadcastNotificationDto,
} from '@/lib/generated/schemas';

export type Notification = NotificationDto;

export interface NotificationPage {
  data: Notification[];
  meta: NotificationControllerFindMine200Meta;
}

export type SendBroadcastNotificationInput = SendBroadcastNotificationDto;
