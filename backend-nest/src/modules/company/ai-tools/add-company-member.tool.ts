import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { AddCompanyMemberUseCase } from '../use-cases/add-company-member.use-case';
import { AddCompanyMemberSchema } from '../dto/add-member.dto';

const AddCompanyMemberInputSchema = z
  .object({ companyId: z.string().uuid() })
  .merge(AddCompanyMemberSchema);
type AddCompanyMemberInput = z.infer<typeof AddCompanyMemberInputSchema>;

@AiToolDef()
@Injectable()
export class AddCompanyMemberTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'add_company_member',
    description:
      'Vincula um usuário já existente a uma empresa como membro. Use invite_company_member para convidar alguém que ainda não tem conta.',
    inputSchema: AddCompanyMemberInputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.COMPANY_WRITE,
    invalidates: [InvalidationTags.COMPANY],
  };

  constructor(private readonly addCompanyMember: AddCompanyMemberUseCase) {}

  execute(input: AddCompanyMemberInput, _ctx: AiToolContext) {
    const { companyId, ...dto } = input;
    return this.addCompanyMember.execute(companyId, dto);
  }
}
