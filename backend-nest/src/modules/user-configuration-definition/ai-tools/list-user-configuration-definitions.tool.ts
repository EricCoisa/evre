import { Injectable } from '@nestjs/common';
import { maskSecretValues } from 'src/common/utils/mask-secret-value.util';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindAllUserConfigDefinitionsUseCase } from '../use-cases/find-all.use-case';
import {
  PaginationQuery,
  PaginationQuerySchema,
} from 'src/common/schemas/pagination.schema';

@AiToolDef()
@Injectable()
export class ListUserConfigurationDefinitionsTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_user_configuration_definitions',
    description:
      'Lista as definições de configuração de usuário disponíveis no sistema, com paginação.',
    inputSchema: PaginationQuerySchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(
    private readonly findAllUseCase: FindAllUserConfigDefinitionsUseCase,
  ) {}

  async execute(input: PaginationQuery, _ctx: AiToolContext) {
    return maskSecretValues(
      await this.findAllUseCase.execute(input),
      'defaultValue',
    );
  }
}
