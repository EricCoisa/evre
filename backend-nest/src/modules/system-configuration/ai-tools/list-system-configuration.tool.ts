import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindAllSystemConfigurationUseCase } from '../use-cases/find-all.use-case';
import {
  PaginationQuery,
  PaginationQuerySchema,
} from 'src/common/schemas/pagination.schema';
import { maskSecretValues } from 'src/common/utils/mask-secret-value.util';

@AiToolDef()
@Injectable()
export class ListSystemConfigurationTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_system_configuration',
    description:
      'Lista as configurações do sistema com paginação. Valores marcados como secretos aparecem mascarados.',
    inputSchema: PaginationQuerySchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(
    private readonly findAllUseCase: FindAllSystemConfigurationUseCase,
  ) {}

  async execute(input: PaginationQuery, ctx: AiToolContext) {
    const result = await this.findAllUseCase.execute(input, {
      roleName: ctx.roleName,
    });
    return maskSecretValues(result, 'value');
  }
}
