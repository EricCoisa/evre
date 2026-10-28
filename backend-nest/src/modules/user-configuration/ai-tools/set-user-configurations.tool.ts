import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { SetUserConfigurationUseCase } from '../use-cases/set-user-configuration.use-case';
import {
  SetUserConfigurationDto,
  SetUserConfigurationSchema,
} from '../dto/set-user-configuration.dto';

@AiToolDef()
@Injectable()
export class SetUserConfigurationTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'set_user_configurations',
    description:
      'Define uma configuração do usuário logado (ex.: tema, idioma). Aplica-se apenas ao próprio usuário.',
    inputSchema: SetUserConfigurationSchema,
    // sem roles: ação self-service, espelha POST /user-configuration/me (qualquer autenticado)
    approvalScope: McpScopes.USER_CONFIGURATION_WRITE,
    invalidates: [InvalidationTags.USER_CONFIGURATION, InvalidationTags.AI],
  };

  constructor(
    private readonly setUserConfigurationUseCase: SetUserConfigurationUseCase,
  ) {}

  execute(input: SetUserConfigurationDto, ctx: AiToolContext) {
    const userId = ctx.userId;
    const performedById = ctx.userId;

    return this.setUserConfigurationUseCase.execute(
      userId,
      input,
      performedById,
    );
  }
}
