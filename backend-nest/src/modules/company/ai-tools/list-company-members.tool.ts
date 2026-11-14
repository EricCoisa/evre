import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { ListCompanyMembersUseCase } from '../use-cases/list-company-members.use-case';
import { PaginationQuerySchema } from 'src/common/schemas/pagination.schema';

const ListCompanyMembersInputSchema = z
  .object({ companyId: z.string().uuid() })
  .merge(PaginationQuerySchema);
type ListCompanyMembersInput = z.infer<typeof ListCompanyMembersInputSchema>;

@AiToolDef()
@Injectable()
export class ListCompanyMembersTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_company_members',
    description:
      'Lista os membros (usuários vinculados) de uma empresa, com paginação e busca por nome/email.',
    inputSchema: ListCompanyMembersInputSchema,
    roles: ['ADMIN', 'MODERATOR'],
    invalidates: [],
  };

  constructor(private readonly listCompanyMembers: ListCompanyMembersUseCase) {}

  execute(input: ListCompanyMembersInput, _ctx: AiToolContext) {
    const { companyId, ...query } = input;
    return this.listCompanyMembers.execute(companyId, query);
  }
}
