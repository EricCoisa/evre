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
import { RemoveCompanyMemberUseCase } from '../use-cases/remove-company-member.use-case';

const RemoveCompanyMemberSchema = z
  .object({ companyId: z.string().uuid(), membershipId: z.string().uuid() })
  .strict();
type RemoveCompanyMemberInput = z.infer<typeof RemoveCompanyMemberSchema>;

@AiToolDef()
@Injectable()
export class RemoveCompanyMemberTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'remove_company_member',
    description:
      'Remove o vínculo de um membro com a empresa (o usuário em si não é excluído). Use list_company_members antes para obter o membershipId.',
    inputSchema: RemoveCompanyMemberSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.COMPANY_WRITE,
    invalidates: [InvalidationTags.COMPANY],
  };

  constructor(
    private readonly removeCompanyMember: RemoveCompanyMemberUseCase,
  ) {}

  execute(input: RemoveCompanyMemberInput, _ctx: AiToolContext) {
    return this.removeCompanyMember.execute(
      input.companyId,
      input.membershipId,
    );
  }
}
