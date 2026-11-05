import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { FindOneProposalUseCase } from '../use-cases/find-one.use-case';

const GetProposalSchema = z.object({ id: z.string().uuid() }).strict();
type GetProposalInput = z.infer<typeof GetProposalSchema>;

@AiToolDef()
@Injectable()
export class GetProposalTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_proposal',
    description: 'Busca uma proposta pelo id.',
    inputSchema: GetProposalSchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(private readonly findOneProposal: FindOneProposalUseCase) {}

  execute(input: GetProposalInput, ctx: AiToolContext) {
    return this.findOneProposal.execute(input.id, toAuthenticatedUser(ctx));
  }
}
