import { Injectable } from '@nestjs/common';
import type { ProposalArtifact } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindOneProposalUseCase } from './find-one.use-case';

/** Lista os artefatos ativos de uma proposta, para o editor escolher/trocar o `storageKey`. */
@Injectable()
export class ListProposalArtifactsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly findOne: FindOneProposalUseCase,
  ) {}

  async execute(
    proposalId: string,
    user: AuthenticatedUser,
  ): Promise<ProposalArtifact[]> {
    const proposal = await this.findOne.execute(proposalId, user);

    return this.prisma.proposalArtifact.findMany({
      where: { proposalId: proposal.id, archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }
}
