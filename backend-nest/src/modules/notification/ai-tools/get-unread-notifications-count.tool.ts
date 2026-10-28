import { Injectable, ForbiddenException } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FeatureFlagService } from '../../feature-flag/feature-flag.service';
import { NOTIFICATION_ROOT_FLAG } from '../use-cases/send-notification.use-case';
import { GetUnreadCountUseCase } from '../use-cases/get-unread-count.use-case';

/** Espelha GET /notification/me/unread-count. */
@AiToolDef()
@Injectable()
export class GetUnreadNotificationsCountTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_unread_notifications_count',
    description:
      'Retorna a quantidade de notificações não lidas e não dispensadas do usuário logado.',
    inputSchema: z.object({}),
    invalidates: [],
  };

  constructor(
    private readonly featureFlags: FeatureFlagService,
    private readonly getUnreadCount: GetUnreadCountUseCase,
  ) {}

  async execute(_input: unknown, ctx: AiToolContext) {
    if (
      !(await this.featureFlags.isEnabled(NOTIFICATION_ROOT_FLAG, ctx.roleName))
    ) {
      throw new ForbiddenException('Notificações desabilitadas para este role');
    }
    return this.getUnreadCount.execute(ctx.userId, ctx.roleName);
  }
}
