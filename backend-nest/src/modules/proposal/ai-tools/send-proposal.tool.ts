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
import { SendProposalUseCase } from '../use-cases/send-proposal.use-case';
import { SendProposalSchema } from '../dto/send-proposal.dto';

const SendProposalInputSchema = z
  .object({ id: z.string().uuid() })
  .merge(SendProposalSchema);
type SendProposalInput = z.infer<typeof SendProposalInputSchema>;

@AiToolDef()
@Injectable()
export class SendProposalTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'send_proposal',
    description:
      'Envia a versão pública vigente da proposta por WhatsApp. Sem telefone, usa o contato principal da empresa. Canal indisponível não lança erro — `succeeded: false` é resultado normal.',
    inputSchema: SendProposalInputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.PROPOSAL_WRITE,
    invalidates: [InvalidationTags.PROPOSAL],
  };

  constructor(private readonly sendProposal: SendProposalUseCase) {}

  execute(input: SendProposalInput, ctx: AiToolContext) {
    return this.sendProposal.execute(
      { proposalId: input.id, phone: input.phone },
      toAuthenticatedUser(ctx),
    );
  }
}
