import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { ListLeadsUseCase } from '../use-cases/list-leads.use-case';
import {
  PaginationQuerySchema,
  PaginationQuery,
} from 'src/common/schemas/pagination.schema';

@AiToolDef()
@Injectable()
export class ListLeadsTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_leads',
    description:
      'Lista os leads recebidos pelo formulário de contato da landing page.',
    inputSchema: PaginationQuerySchema,
    roles: ['ADMIN', 'MODERATOR'],
    invalidates: [],
  };

  constructor(private readonly listLeads: ListLeadsUseCase) {}

  execute(input: PaginationQuery, _ctx: AiToolContext) {
    return this.listLeads.execute(input);
  }
}
