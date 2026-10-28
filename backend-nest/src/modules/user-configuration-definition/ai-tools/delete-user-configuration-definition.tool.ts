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
import { RemoveUserConfigDefinitionUseCase } from '../use-cases/remove.use-case';

const DeleteDefinitionSchema = z.object({ id: z.string().uuid() });
type DeleteDefinitionInput = z.infer<typeof DeleteDefinitionSchema>;

@AiToolDef()
@Injectable()
export class DeleteUserConfigurationDefinitionTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'delete_user_configuration_definition',
    description: 'Remove uma definição de configuração de usuário pelo id.',
    inputSchema: DeleteDefinitionSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.USER_CONFIGURATION_DEFINITIONS_WRITE,
    invalidates: [InvalidationTags.USER_CONFIGURATION_DEFINITIONS],
  };

  constructor(
    private readonly removeUseCase: RemoveUserConfigDefinitionUseCase,
  ) {}

  execute(input: DeleteDefinitionInput, ctx: AiToolContext) {
    return this.removeUseCase.execute(input.id, ctx.userId);
  }
}
