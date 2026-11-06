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
import { ArchiveCompanyContactUseCase } from '../use-cases/archive-company-contact.use-case';

const ArchiveCompanyContactSchema = z
  .object({ companyId: z.string().uuid(), contactId: z.string().uuid() })
  .strict();
type ArchiveCompanyContactInput = z.infer<typeof ArchiveCompanyContactSchema>;

@AiToolDef()
@Injectable()
export class ArchiveCompanyContactTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'archive_company_contact',
    description:
      'Arquiva o vínculo entre uma empresa e um contato (nada é apagado).',
    inputSchema: ArchiveCompanyContactSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.COMPANY_WRITE,
    invalidates: [InvalidationTags.COMPANY],
  };

  constructor(
    private readonly archiveCompanyContact: ArchiveCompanyContactUseCase,
  ) {}

  execute(input: ArchiveCompanyContactInput, ctx: AiToolContext) {
    return this.archiveCompanyContact.execute(
      input.companyId,
      input.contactId,
      toAuthenticatedUser(ctx),
    );
  }
}
