import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { ListCompanyInvitesUseCase } from '../use-cases/list-company-invites.use-case';

const ListCompanyInvitesSchema = z
  .object({ companyId: z.string().uuid() })
  .strict();
type ListCompanyInvitesInput = z.infer<typeof ListCompanyInvitesSchema>;

@AiToolDef()
@Injectable()
export class ListCompanyInvitesTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_company_invites',
    description:
      'Lista os convites (pendentes ou usados) emitidos para ingressar em uma empresa.',
    inputSchema: ListCompanyInvitesSchema,
    roles: ['ADMIN', 'MODERATOR'],
    invalidates: [],
  };

  constructor(private readonly listCompanyInvites: ListCompanyInvitesUseCase) {}

  execute(input: ListCompanyInvitesInput, _ctx: AiToolContext) {
    return this.listCompanyInvites.execute(input.companyId);
  }
}
