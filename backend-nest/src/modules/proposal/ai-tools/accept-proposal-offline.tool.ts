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
import { ResolveCurrentProposalVersionUseCase } from '../use-cases/resolve-current-proposal-version.use-case';
import { AcceptProposalVersionUseCase } from '../use-cases/accept-proposal-version.use-case';
import { AcceptProposalOfflineSchema } from '../dto/accept-proposal-offline.dto';
import { ProposalAcceptanceSourceConst } from 'src/domain/proposal/proposalAcceptanceSource.const';

const AcceptProposalOfflineInputSchema = z
  .object({ id: z.string().uuid() })
  .merge(AcceptProposalOfflineSchema);
type AcceptProposalOfflineInput = z.infer<
  typeof AcceptProposalOfflineInputSchema
>;

/** Registra o aceite em nome do cliente (telefone, reunião, email) — nunca a versão escolhida pelo
 * modelo, só a vigente, mesma regra do `ProposalController.acceptOffline`. */
@AiToolDef()
@Injectable()
export class AcceptProposalOfflineTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'accept_proposal_offline',
    description:
      'Registra o aceite da versão vigente de uma proposta em nome do cliente, recebido por outro canal (telefone, reunião, email). Idempotente.',
    inputSchema: AcceptProposalOfflineInputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.PROPOSAL_WRITE,
    invalidates: [InvalidationTags.PROPOSAL],
  };

  constructor(
    private readonly resolveCurrentProposalVersion: ResolveCurrentProposalVersionUseCase,
    private readonly acceptProposalVersion: AcceptProposalVersionUseCase,
  ) {}

  async execute(input: AcceptProposalOfflineInput, ctx: AiToolContext) {
    const user = toAuthenticatedUser(ctx);
    const current = await this.resolveCurrentProposalVersion.execute(
      input.id,
      user,
    );
    return this.acceptProposalVersion.execute({
      versionId: current.id,
      source: ProposalAcceptanceSourceConst.OFFLINE,
      note: input.note,
      acceptedById: ctx.userId,
    });
  }
}
