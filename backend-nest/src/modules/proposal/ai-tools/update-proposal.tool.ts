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
import { UpdateProposalUseCase } from '../use-cases/update.use-case';
import { UpdateProposalSchema } from '../dto/update-proposal.dto';

const UpdateProposalInputSchema = z
  .object({ id: z.string().uuid() })
  .merge(UpdateProposalSchema);
type UpdateProposalInput = z.infer<typeof UpdateProposalInputSchema>;

@AiToolDef()
@Injectable()
export class UpdateProposalTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_proposal',
    description:
      'Atualiza o nome e/ou a empresa vinculada de uma proposta pelo id.',
    inputSchema: UpdateProposalInputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.PROPOSAL_WRITE,
    invalidates: [InvalidationTags.PROPOSAL],
  };

  constructor(private readonly updateProposal: UpdateProposalUseCase) {}

  execute(input: UpdateProposalInput, ctx: AiToolContext) {
    const { id, ...dto } = input;
    return this.updateProposal.execute(id, dto, toAuthenticatedUser(ctx));
  }
}
