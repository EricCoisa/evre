import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { StopTimerUseCase } from '../use-cases/stop-timer.use-case';

const StopTimerInputSchema = z.object({}).strict();

@AiToolDef()
@Injectable()
export class StopTimerTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'stop_timer',
    description:
      'Finaliza o cronômetro atualmente em execução para o usuário logado e registra o tempo total trabalhado.',
    inputSchema: StopTimerInputSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.TIME_TRACKING_WRITE,
    invalidates: [InvalidationTags.TIME_TRACKING],
  };

  constructor(private readonly stopTimer: StopTimerUseCase) {}

  execute(_input: unknown, ctx: AiToolContext) {
    return this.stopTimer.execute(ctx.userId);
  }
}
