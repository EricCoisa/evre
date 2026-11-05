import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { ListCompanyContactsUseCase } from '../use-cases/list-company-contacts.use-case';

const ListCompanyContactsSchema = z
  .object({ companyId: z.string().uuid() })
  .strict();
type ListCompanyContactsInput = z.infer<typeof ListCompanyContactsSchema>;

@AiToolDef()
@Injectable()
export class ListCompanyContactsTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_company_contacts',
    description: 'Lista os contatos ativos de uma empresa.',
    inputSchema: ListCompanyContactsSchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(
    private readonly listCompanyContacts: ListCompanyContactsUseCase,
  ) {}

  execute(input: ListCompanyContactsInput, ctx: AiToolContext) {
    return this.listCompanyContacts.execute(
      input.companyId,
      toAuthenticatedUser(ctx),
    );
  }
}
