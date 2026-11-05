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
import { UpdateProposalStatusUseCase } from '../use-cases/update-proposal-status.use-case';
import { UpdateProposalStatusSchema } from '../dto/update-proposal-status.dto';

const UpdateProposalStatusInputSchema = z
  .object({ id: z.string().uuid() })
  .merge(UpdateProposalStatusSchema);
type UpdateProposalStatusInput = z.infer<
  typeof UpdateProposalStatusInputSchema
>;

@AiToolDef()
@Injectable()
export class UpdateProposalStatusTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_proposal_status',
    description:
      'Muda o status de uma proposta (ex.: SENT, ACCEPTED, LOST). ACCEPTED e LOST são terminais — exigem `lostReason` quando o novo status é LOST.',
    inputSchema: UpdateProposalStatusInputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.PROPOSAL_WRITE,
    invalidates: [InvalidationTags.PROPOSAL],
  };

  constructor(
    private readonly updateProposalStatus: UpdateProposalStatusUseCase,
  ) {}

  execute(input: UpdateProposalStatusInput, ctx: AiToolContext) {
    const { id, ...dto } = input;
    return this.updateProposalStatus.execute(
      id,
      dto,
      toAuthenticatedUser(ctx),
    );
  }
}
