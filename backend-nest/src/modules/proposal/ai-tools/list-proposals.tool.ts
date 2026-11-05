import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { FindAllProposalUseCase } from '../use-cases/find-all.use-case';
import {
  PaginationQuery,
  PaginationQuerySchema,
} from 'src/common/schemas/pagination.schema';

@AiToolDef()
@Injectable()
export class ListProposalsTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_proposals',
    description:
      'Lista as propostas com paginação e busca por nome/empresa. Filtro opcional por companyId.',
    inputSchema: PaginationQuerySchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(private readonly findAllProposal: FindAllProposalUseCase) {}

  execute(input: PaginationQuery, ctx: AiToolContext) {
    return this.findAllProposal.execute(input, toAuthenticatedUser(ctx));
  }
}
