import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { FindAllCompanyUseCase } from '../use-cases/find-all.use-case';
import {
  PaginationQuery,
  PaginationQuerySchema,
} from 'src/common/schemas/pagination.schema';

@AiToolDef()
@Injectable()
export class ListCompaniesTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_companies',
    description:
      'Lista as empresas (clientes) cadastradas, com paginação e busca por nome/razão social.',
    inputSchema: PaginationQuerySchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(private readonly findAllCompany: FindAllCompanyUseCase) {}

  execute(input: PaginationQuery, ctx: AiToolContext) {
    return this.findAllCompany.execute(input, toAuthenticatedUser(ctx));
  }
}
