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
import { RevokeProposalPublicationUseCase } from '../use-cases/revoke-proposal-publication.use-case';

const RevokeProposalPublicationSchema = z
  .object({ id: z.string().uuid() })
  .strict();
type RevokeProposalPublicationInput = z.infer<
  typeof RevokeProposalPublicationSchema
>;

@AiToolDef()
@Injectable()
export class RevokeProposalPublicationTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'revoke_proposal_publication',
    description:
      'Revoga a versão pública vigente de uma proposta. Idempotente: revogar o já revogado não é erro.',
    inputSchema: RevokeProposalPublicationSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.PROPOSAL_WRITE,
    invalidates: [InvalidationTags.PROPOSAL],
  };

  constructor(
    private readonly revokeProposalPublication: RevokeProposalPublicationUseCase,
  ) {}

  execute(input: RevokeProposalPublicationInput, ctx: AiToolContext) {
    return this.revokeProposalPublication.execute(
      input.id,
      toAuthenticatedUser(ctx),
    );
  }
}
