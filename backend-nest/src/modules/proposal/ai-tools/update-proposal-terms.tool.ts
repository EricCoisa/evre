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
import { UpdateProposalTermsUseCase } from '../use-cases/update-proposal-terms.use-case';
import { UpdateProposalTermsSchema } from '../dto/update-proposal-terms.dto';

const UpdateProposalTermsInputSchema = z
  .object({ id: z.string().uuid() })
  .merge(UpdateProposalTermsSchema);
type UpdateProposalTermsInput = z.infer<typeof UpdateProposalTermsInputSchema>;

@AiToolDef()
@Injectable()
export class UpdateProposalTermsTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_proposal_terms',
    description:
      'Atualiza o envelope comercial (valor, moeda, recorrência, prazo, validade, itens) de uma proposta. Só funciona enquanto a proposta está em DRAFT.',
    inputSchema: UpdateProposalTermsInputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.PROPOSAL_WRITE,
    invalidates: [InvalidationTags.PROPOSAL],
  };

  constructor(
    private readonly updateProposalTerms: UpdateProposalTermsUseCase,
  ) {}

  execute(input: UpdateProposalTermsInput, ctx: AiToolContext) {
    const { id, ...dto } = input;
    return this.updateProposalTerms.execute(id, dto, toAuthenticatedUser(ctx));
  }
}
