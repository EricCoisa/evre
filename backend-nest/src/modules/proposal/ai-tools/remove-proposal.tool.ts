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
import { RemoveProposalUseCase } from '../use-cases/remove.use-case';

const RemoveProposalSchema = z.object({ id: z.string().uuid() }).strict();
type RemoveProposalInput = z.infer<typeof RemoveProposalSchema>;

@AiToolDef()
@Injectable()
export class RemoveProposalTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'remove_proposal',
    description: 'Arquiva uma proposta (nada é apagado).',
    inputSchema: RemoveProposalSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.PROPOSAL_WRITE,
    invalidates: [InvalidationTags.PROPOSAL],
  };

  constructor(private readonly removeProposal: RemoveProposalUseCase) {}

  execute(input: RemoveProposalInput, ctx: AiToolContext) {
    return this.removeProposal.execute(input.id, toAuthenticatedUser(ctx));
  }
}
