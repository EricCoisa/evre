import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { ProposalStatusConst } from 'src/domain/proposal/proposalStatus.const';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { Proposal } from 'src/domain/proposal/proposal.entity';
import { FindOneProposalUseCase } from './find-one.use-case';

/** Devolve a proposta para DRAFT independente do status anterior. Revoga a versão pública vigente
 * na mesma transação; histórico de aceite (acceptedAt) é preservado como auditoria. */
@Injectable()
export class ReopenProposalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly findOne: FindOneProposalUseCase,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<Proposal> {
    const found = await this.findOne.execute(id, user);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.proposalVersion.updateMany({
        where: { proposalId: id, publicToken: { not: null }, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return tx.proposal.update({
        where: { id },
        data: { status: ProposalStatusConst.DRAFT, lostReason: null },
      });
    });

    if (found.status !== ProposalStatusConst.DRAFT) {
      await this.loggingService.create(
        {
          module: 'PROPOSAL',
          action: LogActions.UPDATE,
          message: `Proposal reaberta para edição (era ${found.status}): ${found.name}`,
          metadata: { proposalId: id, previousStatus: found.status },
        },
        user.id,
      );
    }

    return updated as unknown as Proposal;
  }
}
