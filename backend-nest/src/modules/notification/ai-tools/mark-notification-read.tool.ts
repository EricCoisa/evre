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
import { MarkReadUseCase } from '../use-cases/mark-read.use-case';

const MarkNotificationReadSchema = z.object({
  id: z
    .string()
    .uuid()
    .describe(
      'Id do destinatário da notificação, retornado por list_my_notifications.',
    ),
});
type MarkNotificationReadInput = z.infer<typeof MarkNotificationReadSchema>;

/** Espelha PATCH /notification/me/:id/read. */
@AiToolDef()
@Injectable()
export class MarkNotificationReadTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'mark_notification_read',
    description:
      'Marca uma notificação do usuário logado como lida. Use list_my_notifications antes para obter o id.',
    inputSchema: MarkNotificationReadSchema,
    approvalScope: McpScopes.NOTIFICATION_WRITE,
    invalidates: [InvalidationTags.NOTIFICATION],
  };

  constructor(
    private readonly featureFlags: FeatureFlagService,
    private readonly markRead: MarkReadUseCase,
  ) {}

  async execute(input: MarkNotificationReadInput, ctx: AiToolContext) {
    if (
      !(await this.featureFlags.isEnabled(NOTIFICATION_ROOT_FLAG, ctx.roleName))
    ) {
      throw new ForbiddenException('Notificações desabilitadas para este role');
    }
    return this.markRead.execute(ctx.userId, input.id);
  }
}
