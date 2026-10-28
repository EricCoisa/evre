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
import { ResetAllUserConfigurationsUseCase } from '../use-cases/reset-all.use-case';

@AiToolDef()
@Injectable()
export class ResetAllMyConfigurationsTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'reset_all_my_configurations',
    description:
      'Remove TODAS as customizações do usuário logado, voltando todas as configurações ao padrão.',
    inputSchema: z.object({}),
    approvalScope: McpScopes.USER_CONFIGURATION_WRITE,
    invalidates: [InvalidationTags.USER_CONFIGURATION, InvalidationTags.AI],
  };

  constructor(
    private readonly resetAllUseCase: ResetAllUserConfigurationsUseCase,
  ) {}

  execute(_input: unknown, ctx: AiToolContext) {
    return this.resetAllUseCase.execute(ctx.userId, ctx.userId);
  }
}
