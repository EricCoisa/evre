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
import { PublishProposalUseCase } from '../use-cases/publish-proposal.use-case';

const PublishProposalSchema = z.object({ id: z.string().uuid() }).strict();
type PublishProposalInput = z.infer<typeof PublishProposalSchema>;

@AiToolDef()
@Injectable()
export class PublishProposalTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'publish_proposal',
    description:
      'Publica a proposta: congela layout e envelope numa nova versão, gera o token público e revoga a versão anterior. Exige layout preenchido e a proposta não arquivada.',
    inputSchema: PublishProposalSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.PROPOSAL_WRITE,
    invalidates: [InvalidationTags.PROPOSAL],
  };

  constructor(private readonly publishProposal: PublishProposalUseCase) {}

  execute(input: PublishProposalInput, ctx: AiToolContext) {
    return this.publishProposal.execute(input.id, toAuthenticatedUser(ctx));
  }
}
