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
import { DuplicateProposalUseCase } from '../use-cases/duplicate-proposal.use-case';

const DuplicateProposalSchema = z.object({ id: z.string().uuid() }).strict();
type DuplicateProposalInput = z.infer<typeof DuplicateProposalSchema>;

@AiToolDef()
@Injectable()
export class DuplicateProposalTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'duplicate_proposal',
    description:
      'Duplica uma proposta como um novo rascunho (DRAFT), copiando nome, layout e envelope comercial — sem versão nem token público.',
    inputSchema: DuplicateProposalSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.PROPOSAL_WRITE,
    invalidates: [InvalidationTags.PROPOSAL],
  };

  constructor(
    private readonly duplicateProposal: DuplicateProposalUseCase,
  ) {}

  execute(input: DuplicateProposalInput, ctx: AiToolContext) {
    return this.duplicateProposal.execute(input.id, toAuthenticatedUser(ctx));
  }
}
