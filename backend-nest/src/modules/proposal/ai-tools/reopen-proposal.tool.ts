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
import { ReopenProposalUseCase } from '../use-cases/reopen-proposal.use-case';

const ReopenProposalSchema = z.object({ id: z.string().uuid() }).strict();
type ReopenProposalInput = z.infer<typeof ReopenProposalSchema>;

@AiToolDef()
@Injectable()
export class ReopenProposalTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'reopen_proposal',
    description:
      'Devolve a proposta para DRAFT a partir de qualquer status e revoga a versão pública vigente. O histórico de aceite é preservado.',
    inputSchema: ReopenProposalSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.PROPOSAL_WRITE,
    invalidates: [InvalidationTags.PROPOSAL],
  };

  constructor(private readonly reopenProposal: ReopenProposalUseCase) {}

  execute(input: ReopenProposalInput, ctx: AiToolContext) {
    return this.reopenProposal.execute(input.id, toAuthenticatedUser(ctx));
  }
}
