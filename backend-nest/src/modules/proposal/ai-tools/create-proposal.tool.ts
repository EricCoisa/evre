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
import { CreateProposalUseCase } from '../use-cases/create.use-case';
import { CreateProposalSchema } from '../dto/create-proposal.dto';

type CreateProposalInput = z.infer<typeof CreateProposalSchema>;

@AiToolDef()
@Injectable()
export class CreateProposalTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'create_proposal',
    description:
      'Cria uma nova proposta (nasce DRAFT, sem layout nem versão). Só o nome é obrigatório.',
    inputSchema: CreateProposalSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.PROPOSAL_WRITE,
    invalidates: [InvalidationTags.PROPOSAL],
  };

  constructor(private readonly createProposal: CreateProposalUseCase) {}

  execute(input: CreateProposalInput, ctx: AiToolContext) {
    return this.createProposal.execute(input, ctx.userId);
  }
}
