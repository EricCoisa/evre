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
import { UpdateCompanyContactUseCase } from '../use-cases/update-company-contact.use-case';
import { UpdateContactSchema } from '../dto/update-contact.dto';

const UpdateCompanyContactInputSchema = z
  .object({ companyId: z.string().uuid(), contactId: z.string().uuid() })
  .merge(UpdateContactSchema);
type UpdateCompanyContactInput = z.infer<
  typeof UpdateCompanyContactInputSchema
>;

@AiToolDef()
@Injectable()
export class UpdateCompanyContactTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_company_contact',
    description: 'Atualiza metadata do vínculo entre uma empresa e um contato.',
    inputSchema: UpdateCompanyContactInputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.COMPANY_WRITE,
    invalidates: [InvalidationTags.COMPANY],
  };

  constructor(
    private readonly updateCompanyContact: UpdateCompanyContactUseCase,
  ) {}

  execute(input: UpdateCompanyContactInput, ctx: AiToolContext) {
    const { companyId, contactId, ...dto } = input;
    return this.updateCompanyContact.execute(
      companyId,
      contactId,
      dto,
      toAuthenticatedUser(ctx),
    );
  }
}
