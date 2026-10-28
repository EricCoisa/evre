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
import { CreateUserConfigDefinitionUseCase } from '../use-cases/create.use-case';
import { CreateUserConfigurationDefinitionCreateSchema } from '../dto/create-system-configuration.dto';

type CreateDefinitionInput = z.infer<
  typeof CreateUserConfigurationDefinitionCreateSchema
>;

@AiToolDef()
@Injectable()
export class CreateUserConfigurationDefinitionTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'create_user_configuration_definition',
    description:
      'Cria uma nova definição de configuração que os usuários poderão personalizar.',
    inputSchema: CreateUserConfigurationDefinitionCreateSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.USER_CONFIGURATION_DEFINITIONS_WRITE,
    invalidates: [InvalidationTags.USER_CONFIGURATION_DEFINITIONS],
  };

  constructor(
    private readonly createUseCase: CreateUserConfigDefinitionUseCase,
  ) {}

  async execute(input: CreateDefinitionInput, ctx: AiToolContext) {
    return maskSecretValue(
      await this.createUseCase.execute(input, ctx.userId),
      'defaultValue',
    );
  }
}
