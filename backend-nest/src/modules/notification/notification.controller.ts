import { Body, Controller, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { plainToInstance } from 'class-transformer';
import {
  GetApi,
  PatchApi,
  PostApi,
} from '../../common/decorators/api-method.decorator';
import {
  FeatureFlagGuard,
  RequireFeature,
} from '../feature-flag/feature-flag.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import { NOTIFICATION_ROOT_FLAG } from './use-cases/send-notification.use-case';
import { ListMyNotificationsUseCase } from './use-cases/list-my-notifications.use-case';
import { GetUnreadCountUseCase } from './use-cases/get-unread-count.use-case';
import { MarkReadUseCase } from './use-cases/mark-read.use-case';
import { MarkAllReadUseCase } from './use-cases/mark-all-read.use-case';
import { DismissNotificationUseCase } from './use-cases/dismiss.use-case';
import { SendBroadcastNotificationUseCase } from './use-cases/send-broadcast-notification.use-case';
import { NotificationDto } from './dto/notification.dto';
import { SendBroadcastNotificationDto } from './dto/send-broadcast-notification.dto';
import { ListMyNotificationsQuerySchema } from './dto/list-my-notifications-query.dto';
import type { ListMyNotificationsQuery } from './dto/list-my-notifications-query.dto';
import type { PaginatedResponse } from 'src/common/types/pagination.types';

@ApiTags('notification')
@Controller('notification')
export class NotificationController {
  constructor(
    private readonly listMyNotifications: ListMyNotificationsUseCase,
    private readonly getUnreadCount: GetUnreadCountUseCase,
    private readonly markRead: MarkReadUseCase,
    private readonly markAllRead: MarkAllReadUseCase,
    private readonly dismiss: DismissNotificationUseCase,
    private readonly sendBroadcast: SendBroadcastNotificationUseCase,
  ) {}

  @UseGuards(FeatureFlagGuard)
  @RequireFeature(NOTIFICATION_ROOT_FLAG)
  @GetApi({
    path: 'me',
    summary: 'Lista as notificações do usuário logado',
    status: 'OK',
    authenticated: true,
    queries: [
      ...commonPaginationQueries,
      {
        name: 'unreadOnly',
        required: false,
        type: Boolean,
        description: 'Só notificações não lidas',
        example: false,
      },
    ],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Lista paginada de notificações',
          schema: { dto: NotificationDto, isArray: true, isPagination: true },
        },
      ],
    },
  })
  async findMine(
    @Query(new ZodValidationPipe(ListMyNotificationsQuerySchema))
    query: ListMyNotificationsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponse<NotificationDto> | NotificationDto[]> {
    const { unreadOnly, ...pagination } = query;
    const result = await this.listMyNotifications.execute(
      user.id,
      user.roleName,
      pagination,
      unreadOnly ?? false,
    );

    if (Array.isArray(result)) {
      return plainToInstance(NotificationDto, result);
    }
    return {
      data: plainToInstance(NotificationDto, result.data),
      meta: result.meta,
      ...(result.filter ? { filter: result.filter } : {}),
    };
  }

  @UseGuards(FeatureFlagGuard)
  @RequireFeature(NOTIFICATION_ROOT_FLAG)
  @GetApi({
    path: 'me/unread-count',
    summary: 'Quantidade de notificações não lidas do usuário logado',
    status: 'OK',
    authenticated: true,
    response: {
      success: [{ status: 'OK', description: 'Contador', type: Number }],
    },
  })
  async unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<number> {
    return this.getUnreadCount.execute(user.id, user.roleName);
  }

  @UseGuards(FeatureFlagGuard)
  @RequireFeature(NOTIFICATION_ROOT_FLAG)
  @PatchApi({
    path: 'me/:id/read',
    summary: 'Marca uma notificação como lida',
    status: 'OK',
    authenticated: true,
  })
  async markOneRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.markRead.execute(user.id, id);
  }

  @UseGuards(FeatureFlagGuard)
  @RequireFeature(NOTIFICATION_ROOT_FLAG)
  @PostApi({
    path: 'me/read-all',
    summary: 'Marca todas as notificações do usuário logado como lidas',
    status: 'OK',
    authenticated: true,
  })
  async markAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.markAllRead.execute(user.id, user.roleName);
  }

  @UseGuards(FeatureFlagGuard)
  @RequireFeature(NOTIFICATION_ROOT_FLAG)
  @PatchApi({
    path: 'me/:id/dismiss',
    summary: 'Dispensa uma notificação (sai do inbox do usuário logado)',
    status: 'OK',
    authenticated: true,
  })
  async dismissOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.dismiss.execute(user.id, id);
  }

  // Única rota do módulo que não é escopo "me" — composer admin (ver docs/backend/notifications.md).
  @UseGuards(FeatureFlagGuard)
  @RequireFeature(NOTIFICATION_ROOT_FLAG)
  @PostApi({
    path: 'broadcast',
    summary:
      'Envia uma notificação manual para todos os usuários ou para roles específicas',
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
    body: SendBroadcastNotificationDto,
  })
  async broadcast(
    @Body() dto: SendBroadcastNotificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.sendBroadcast.execute(dto, user.id);
  }
}
