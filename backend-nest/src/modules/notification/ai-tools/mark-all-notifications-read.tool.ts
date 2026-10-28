import { Injectable, ForbiddenException } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FeatureFlagService } from '../../feature-flag/feature-flag.service';
import { NOTIFICATION_ROOT_FLAG } from '../use-cases/send-notification.use-case';
import { MarkAllReadUseCase } from '../use-cases/mark-all-read.use-case';

/** Espelha POST /notification/me/read-all. */
@AiToolDef()
@Injectable()
export class MarkAllNotificationsReadTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'mark_all_notifications_read',
    description: 'Marca todas as notificações do usuário logado como lidas.',
    inputSchema: z.object({}),
    approvalScope: McpScopes.NOTIFICATION_WRITE,
    invalidates: [InvalidationTags.NOTIFICATION],
  };

  constructor(
    private readonly featureFlags: FeatureFlagService,
    private readonly markAllRead: MarkAllReadUseCase,
  ) {}

  async execute(_input: unknown, ctx: AiToolContext) {
    if (
      !(await this.featureFlags.isEnabled(NOTIFICATION_ROOT_FLAG, ctx.roleName))
    ) {
      throw new ForbiddenException('Notificações desabilitadas para este role');
    }
    return this.markAllRead.execute(ctx.userId, ctx.roleName);
  }
}
