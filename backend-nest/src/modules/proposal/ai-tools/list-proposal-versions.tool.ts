import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { ListProposalVersionsUseCase } from '../use-cases/list-proposal-versions.use-case';

const ListProposalVersionsSchema = z.object({ id: z.string().uuid() }).strict();
type ListProposalVersionsInput = z.infer<typeof ListProposalVersionsSchema>;

@AiToolDef()
@Injectable()
export class ListProposalVersionsTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_proposal_versions',
    description:
      'Lista as versões publicadas de uma proposta (mais recente primeiro), com estado de publicação (ativa, revogada, expirada, nenhuma) e URL pública.',
    inputSchema: ListProposalVersionsSchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(
    private readonly listProposalVersions: ListProposalVersionsUseCase,
  ) {}

  execute(input: ListProposalVersionsInput, ctx: AiToolContext) {
    return this.listProposalVersions.execute(
      input.id,
      toAuthenticatedUser(ctx),
    );
  }
}
