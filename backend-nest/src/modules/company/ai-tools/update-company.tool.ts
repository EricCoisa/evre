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
import { UpdateCompanyUseCase } from '../use-cases/update.use-case';
import { UpdateCompanySchema } from '../dto/update-company.dto';

const UpdateCompanyInputSchema = z
  .object({ id: z.string().uuid() })
  .merge(UpdateCompanySchema);
type UpdateCompanyInput = z.infer<typeof UpdateCompanyInputSchema>;

@AiToolDef()
@Injectable()
export class UpdateCompanyTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_company',
    description: 'Atualiza os dados de uma empresa pelo id.',
    inputSchema: UpdateCompanyInputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.COMPANY_WRITE,
    invalidates: [InvalidationTags.COMPANY],
  };

  constructor(private readonly updateCompany: UpdateCompanyUseCase) {}

  execute(input: UpdateCompanyInput, ctx: AiToolContext) {
    const { id, ...dto } = input;
    return this.updateCompany.execute(id, dto, toAuthenticatedUser(ctx));
  }
}
