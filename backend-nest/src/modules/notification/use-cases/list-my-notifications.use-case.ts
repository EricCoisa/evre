import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { paginate } from 'src/common/utils/paginate.util';
import type { PaginationQuery } from 'src/common/schemas/pagination.schema';
import type { PaginatedResponse } from 'src/common/types/pagination.types';
import { NotificationDto } from '../dto/notification.dto';
import { MaterializeBroadcastRecipientsUseCase } from './materialize-broadcast-recipients.use-case';

type RecipientRow = Prisma.NotificationRecipientGetPayload<{
  include: { notification: true };
}>;

@Injectable()
export class ListMyNotificationsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly materializeBroadcast: MaterializeBroadcastRecipientsUseCase,
  ) {}

  async execute(
    userId: string,
    roleName: string,
    query: PaginationQuery,
    unreadOnly: boolean,
  ): Promise<PaginatedResponse<NotificationDto> | NotificationDto[]> {
    await this.materializeBroadcast.execute(userId, roleName);

    const where: Prisma.NotificationRecipientWhereInput = {
      userId,
      dismissedAt: null,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    return paginate<RecipientRow, NotificationDto>(query, {
      findMany: ({ skip, take }) =>
        this.prisma.notificationRecipient.findMany({
          where,
          include: { notification: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
      count: () => this.prisma.notificationRecipient.count({ where }),
      map: (row) => this.toDto(row),
    });
  }

  private toDto(row: RecipientRow): NotificationDto {
    const { notification } = row;
    const payload =
      (notification.payload as Record<string, unknown>) ?? undefined;

    const title = notification.titleKey
      ? String(
          this.i18n.t(notification.titleKey, {
            args: payload,
            defaultValue: notification.title ?? notification.titleKey,
          }),
        )
      : notification.title;

    const message = notification.messageKey
      ? String(
          this.i18n.t(notification.messageKey, {
            args: payload,
            defaultValue: notification.message ?? notification.messageKey,
          }),
        )
      : notification.message;

    return {
      // O id do destinatário (não o do evento): é o que /me/:id/read e /me/:id/dismiss esperam.
      id: row.id,
      type: notification.type,
      title,
      message,
      payload: (notification.payload as Record<string, unknown>) ?? null,
      actionUrl: notification.actionUrl,
      readAt: row.readAt,
      dismissedAt: row.dismissedAt,
      createdAt: notification.createdAt,
    };
  }
}
