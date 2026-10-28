import { Injectable } from '@nestjs/common';
import type { ProposalSend } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindOneProposalUseCase } from './find-one.use-case';

/** Histórico de envios da proposta (todas as versões), mais recente primeiro — "mandei e não chegou"
 * também aparece aqui, já que `ProposalSend` grava mesmo quando o canal falha. */
@Injectable()
export class ListProposalSendsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly findOne: FindOneProposalUseCase,
  ) {}

  async execute(
    proposalId: string,
    user: AuthenticatedUser,
  ): Promise<ProposalSend[]> {
    const proposal = await this.findOne.execute(proposalId, user);

    return this.prisma.proposalSend.findMany({
      where: { version: { proposalId: proposal.id } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
