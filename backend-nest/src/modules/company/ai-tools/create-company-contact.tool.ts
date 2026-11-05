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
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { CreateCompanyContactUseCase } from '../use-cases/create-company-contact.use-case';
import { CreateContactSchema } from '../dto/create-contact.dto';

const CreateCompanyContactInputSchema = z
  .object({ companyId: z.string().uuid() })
  .merge(CreateContactSchema);
type CreateCompanyContactInput = z.infer<
  typeof CreateCompanyContactInputSchema
>;

@AiToolDef()
@Injectable()
export class CreateCompanyContactTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'create_company_contact',
    description:
      'Vincula um contato (telefone) a uma empresa, criando o contato de mensageria se ainda não existir.',
    inputSchema: CreateCompanyContactInputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.COMPANY_WRITE,
    invalidates: [InvalidationTags.COMPANY],
  };

  constructor(
    private readonly createCompanyContact: CreateCompanyContactUseCase,
  ) {}

  execute(input: CreateCompanyContactInput, ctx: AiToolContext) {
    const { companyId, ...dto } = input;
    return this.createCompanyContact.execute(
      companyId,
      dto,
      toAuthenticatedUser(ctx),
    );
  }
}
