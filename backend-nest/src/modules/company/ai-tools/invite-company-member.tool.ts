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
import { InviteCompanyMemberUseCase } from '../use-cases/invite-company-member.use-case';
import { InviteCompanyMemberSchema } from '../dto/add-member.dto';

const InviteCompanyMemberInputSchema = z
  .object({ companyId: z.string().uuid() })
  .merge(InviteCompanyMemberSchema);
type InviteCompanyMemberInput = z.infer<typeof InviteCompanyMemberInputSchema>;

@AiToolDef()
@Injectable()
export class InviteCompanyMemberTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'invite_company_member',
    description:
      'Convida alguém para ingressar em uma empresa por email ou WhatsApp, criando um convite de cadastro (role USER). Use para quem ainda não tem conta no sistema.',
    inputSchema: InviteCompanyMemberInputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.COMPANY_WRITE,
    invalidates: [InvalidationTags.COMPANY],
  };

  constructor(
    private readonly inviteCompanyMember: InviteCompanyMemberUseCase,
  ) {}

  execute(input: InviteCompanyMemberInput, ctx: AiToolContext) {
    const { companyId, ...dto } = input;
    return this.inviteCompanyMember.execute(companyId, dto, ctx.userId);
  }
}
