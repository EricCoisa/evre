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
import { UpdateCompanyMemberUseCase } from '../use-cases/update-company-member.use-case';
import { UpdateCompanyMemberSchema } from '../dto/add-member.dto';

const UpdateCompanyMemberInputSchema = z
  .object({ companyId: z.string().uuid(), membershipId: z.string().uuid() })
  .merge(UpdateCompanyMemberSchema);
type UpdateCompanyMemberInput = z.infer<typeof UpdateCompanyMemberInputSchema>;

@AiToolDef()
@Injectable()
export class UpdateCompanyMemberTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_company_member',
    description:
      'Atualiza as permissões de um membro de empresa (ver comercial, comentar). Use list_company_members antes para obter o membershipId.',
    inputSchema: UpdateCompanyMemberInputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.COMPANY_WRITE,
    invalidates: [InvalidationTags.COMPANY],
  };

  constructor(
    private readonly updateCompanyMember: UpdateCompanyMemberUseCase,
  ) {}

  execute(input: UpdateCompanyMemberInput, _ctx: AiToolContext) {
    const { companyId, membershipId, ...dto } = input;
    return this.updateCompanyMember.execute(companyId, membershipId, dto);
  }
}
