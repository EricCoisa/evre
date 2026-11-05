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
import { UpdateProposalLayoutUseCase } from '../use-cases/update-proposal-layout.use-case';
import { UpdateProposalLayoutSchema } from '../dto/update-proposal-layout.dto';

const UpdateProposalLayoutInputSchema = z
  .object({ id: z.string().uuid() })
  .merge(UpdateProposalLayoutSchema);
type UpdateProposalLayoutInput = z.infer<
  typeof UpdateProposalLayoutInputSchema
>;

@AiToolDef()
@Injectable()
export class UpdateProposalLayoutTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_proposal_layout',
    description:
      'Grava o rascunho do layout (PageBuilder) de uma proposta. Só funciona enquanto a proposta está em DRAFT.',
    inputSchema: UpdateProposalLayoutInputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.PROPOSAL_WRITE,
    invalidates: [InvalidationTags.PROPOSAL],
  };

  constructor(
    private readonly updateProposalLayout: UpdateProposalLayoutUseCase,
  ) {}

  execute(input: UpdateProposalLayoutInput, ctx: AiToolContext) {
    const { id, ...dto } = input;
    return this.updateProposalLayout.execute(
      id,
      dto,
      toAuthenticatedUser(ctx),
    );
  }
}
