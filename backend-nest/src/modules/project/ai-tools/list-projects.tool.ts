import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { FindAllProjectUseCase } from '../use-cases/find-all.use-case';
import {
  PaginationQuery,
  PaginationQuerySchema,
} from 'src/common/schemas/pagination.schema';

@AiToolDef()
@Injectable()
export class ListProjectsTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_projects',
    description:
      'Lista projetos com paginação, busca por nome (do projeto ou da empresa) e filtro por companyId. O escopo de visibilidade segue o acesso do usuário logado.',
    inputSchema: PaginationQuerySchema,
    invalidates: [],
  };

  constructor(private readonly findAllProject: FindAllProjectUseCase) {}

  execute(input: PaginationQuery, ctx: AiToolContext) {
    return this.findAllProject.execute(input, toAuthenticatedUser(ctx));
  }
}
