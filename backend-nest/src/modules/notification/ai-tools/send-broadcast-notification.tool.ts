import { Injectable, ForbiddenException } from '@nestjs/common';
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
import { SendBroadcastNotificationUseCase } from '../use-cases/send-broadcast-notification.use-case';
import {
  SendBroadcastNotificationSchema,
  type SendBroadcastNotificationDto,
} from '../dto/send-broadcast-notification.dto';

/** Espelha POST /notification/broadcast — único endpoint do módulo que não é escopo "me". */
@AiToolDef()
@Injectable()
export class SendBroadcastNotificationTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'send_broadcast_notification',
    description:
      'Envia uma notificação manual para todos os usuários ativos ("all") ou para roles específicas ("roleNames"). Chega por email e WhatsApp se o usuário tiver esses canais habilitados. Use com cautela — afeta todos os destinatários de uma vez.',
    inputSchema: SendBroadcastNotificationSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.NOTIFICATION_WRITE,
    invalidates: [InvalidationTags.NOTIFICATION],
  };

  constructor(
    private readonly featureFlags: FeatureFlagService,
    private readonly sendBroadcast: SendBroadcastNotificationUseCase,
  ) {}

  async execute(input: SendBroadcastNotificationDto, ctx: AiToolContext) {
    if (
      !(await this.featureFlags.isEnabled(NOTIFICATION_ROOT_FLAG, ctx.roleName))
    ) {
      throw new ForbiddenException('Notificações desabilitadas para este role');
    }
    return this.sendBroadcast.execute(input, ctx.userId);
  }
}
