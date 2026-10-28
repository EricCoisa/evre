import { Injectable, ForbiddenException } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FeatureFlagService } from '../../feature-flag/feature-flag.service';
import { NOTIFICATION_ROOT_FLAG } from '../use-cases/send-notification.use-case';
import { ListMyNotificationsUseCase } from '../use-cases/list-my-notifications.use-case';
import {
  ListMyNotificationsQuerySchema,
  type ListMyNotificationsQuery,
} from '../dto/list-my-notifications-query.dto';

/** Espelha GET /notification/me, incluindo o guard de feature flag (NOTIFICATION_ROOT_FLAG). */
@AiToolDef()
@Injectable()
export class ListMyNotificationsTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_my_notifications',
    description:
      'Lista as notificações do usuário logado, com paginação e filtro opcional "unreadOnly" para só as não lidas.',
    inputSchema: ListMyNotificationsQuerySchema,
    invalidates: [],
  };

  constructor(
    private readonly featureFlags: FeatureFlagService,
    private readonly listMyNotifications: ListMyNotificationsUseCase,
  ) {}

  async execute(input: ListMyNotificationsQuery, ctx: AiToolContext) {
    if (
      !(await this.featureFlags.isEnabled(NOTIFICATION_ROOT_FLAG, ctx.roleName))
    ) {
      throw new ForbiddenException('Notificações desabilitadas para este role');
    }
    const { unreadOnly, ...pagination } = input;
    return this.listMyNotifications.execute(
      ctx.userId,
      ctx.roleName,
      pagination,
      unreadOnly ?? false,
    );
  }
}
