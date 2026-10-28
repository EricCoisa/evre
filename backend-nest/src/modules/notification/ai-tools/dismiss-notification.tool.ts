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
import { DismissNotificationUseCase } from '../use-cases/dismiss.use-case';

const DismissNotificationSchema = z.object({
  id: z
    .string()
    .uuid()
    .describe(
      'Id do destinatário da notificação, retornado por list_my_notifications.',
    ),
});
type DismissNotificationInput = z.infer<typeof DismissNotificationSchema>;

/** Espelha PATCH /notification/me/:id/dismiss. */
@AiToolDef()
@Injectable()
export class DismissNotificationTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'dismiss_notification',
    description:
      'Dispensa uma notificação do usuário logado, removendo-a do inbox (sem apagar o registro). Use list_my_notifications antes para obter o id.',
    inputSchema: DismissNotificationSchema,
    approvalScope: McpScopes.NOTIFICATION_WRITE,
    invalidates: [InvalidationTags.NOTIFICATION],
  };

  constructor(
    private readonly featureFlags: FeatureFlagService,
    private readonly dismiss: DismissNotificationUseCase,
  ) {}

  async execute(input: DismissNotificationInput, ctx: AiToolContext) {
    if (
      !(await this.featureFlags.isEnabled(NOTIFICATION_ROOT_FLAG, ctx.roleName))
    ) {
      throw new ForbiddenException('Notificações desabilitadas para este role');
    }
    return this.dismiss.execute(ctx.userId, input.id);
  }
}
