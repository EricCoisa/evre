import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { ListProposalSendsUseCase } from '../use-cases/list-proposal-sends.use-case';

const ListProposalSendsSchema = z.object({ id: z.string().uuid() }).strict();
type ListProposalSendsInput = z.infer<typeof ListProposalSendsSchema>;

@AiToolDef()
@Injectable()
export class ListProposalSendsTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_proposal_sends',
    description:
      'Lista o histórico de envios de uma proposta (todas as versões), mais recente primeiro — inclui tentativas que falharam.',
    inputSchema: ListProposalSendsSchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(private readonly listProposalSends: ListProposalSendsUseCase) {}

  execute(input: ListProposalSendsInput, ctx: AiToolContext) {
    return this.listProposalSends.execute(input.id, toAuthenticatedUser(ctx));
  }
}
