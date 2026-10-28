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
import { ResetUserConfigurationUseCase } from '../use-cases/reset-user-configuration.use-case';

const ResetMyConfigurationSchema = z.object({
  definitionId: z.string().uuid(),
});
type ResetMyConfigurationInput = z.infer<typeof ResetMyConfigurationSchema>;

@AiToolDef()
@Injectable()
export class ResetMyConfigurationTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'reset_my_configuration',
    description:
      'Remove a customização do usuário logado para uma configuração, voltando ao valor padrão.',
    inputSchema: ResetMyConfigurationSchema,
    approvalScope: McpScopes.USER_CONFIGURATION_WRITE,
    invalidates: [InvalidationTags.USER_CONFIGURATION, InvalidationTags.AI],
  };

  constructor(private readonly resetUseCase: ResetUserConfigurationUseCase) {}

  execute(input: ResetMyConfigurationInput, ctx: AiToolContext) {
    return this.resetUseCase.execute(
      ctx.userId,
      input.definitionId,
      ctx.userId,
    );
  }
}
