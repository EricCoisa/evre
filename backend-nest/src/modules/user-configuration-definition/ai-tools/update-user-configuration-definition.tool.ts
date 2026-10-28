import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { maskSecretValue } from 'src/common/utils/mask-secret-value.util';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { UpdateUserConfigDefinitionUseCase } from '../use-cases/update.use-case';
import { UpdateUserConfigurationDefinitionsSchema } from '../dto/update-user-configuration-definition.dto';

const UpdateDefinitionToolSchema = z
  .object({ id: z.string().uuid() })
  .extend(UpdateUserConfigurationDefinitionsSchema.shape);
type UpdateDefinitionInput = z.infer<typeof UpdateDefinitionToolSchema>;

@AiToolDef()
@Injectable()
export class UpdateUserConfigurationDefinitionTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_user_configuration_definition',
    description: 'Atualiza uma definição de configuração de usuário pelo id.',
    inputSchema: UpdateDefinitionToolSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.USER_CONFIGURATION_DEFINITIONS_WRITE,
    invalidates: [InvalidationTags.USER_CONFIGURATION_DEFINITIONS],
  };

  constructor(
    private readonly updateUseCase: UpdateUserConfigDefinitionUseCase,
  ) {}

  async execute(input: UpdateDefinitionInput, ctx: AiToolContext) {
    const { id, ...dto } = input;
    return maskSecretValue(
      await this.updateUseCase.execute(id, dto, ctx.userId),
      'defaultValue',
    );
  }
}
