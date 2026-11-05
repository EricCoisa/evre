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
import { RemoveCompanyUseCase } from '../use-cases/remove.use-case';

const RemoveCompanySchema = z.object({ id: z.string().uuid() }).strict();
type RemoveCompanyInput = z.infer<typeof RemoveCompanySchema>;

@AiToolDef()
@Injectable()
export class RemoveCompanyTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'remove_company',
    description:
      'Arquiva uma empresa (nada é apagado). Recusa se houver proposta em andamento vinculada a ela.',
    inputSchema: RemoveCompanySchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.COMPANY_WRITE,
    invalidates: [InvalidationTags.COMPANY],
  };

  constructor(private readonly removeCompany: RemoveCompanyUseCase) {}

  execute(input: RemoveCompanyInput, ctx: AiToolContext) {
    return this.removeCompany.execute(input.id, toAuthenticatedUser(ctx));
  }
}
