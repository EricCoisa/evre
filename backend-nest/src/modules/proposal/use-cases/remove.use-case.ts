import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { Proposal } from 'src/domain/proposal/proposal.entity';
import { FindOneProposalUseCase } from './find-one.use-case';

/** "Remover" uma proposta é arquivar — nada é apagado (histórico de versão/aceite depende dela). */
@Injectable()
export class RemoveProposalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly findOne: FindOneProposalUseCase,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<Proposal> {
    const found = await this.findOne.execute(id, user);

    const archived = found.archivedAt
      ? found
      : ((await this.prisma.proposal.update({
          where: { id },
          data: { archivedAt: new Date() },
        })) as unknown as Proposal);

    if (!found.archivedAt) {
      await this.loggingService.create(
        {
          module: 'PROPOSAL',
          action: LogActions.ARCHIVE,
          message: `Proposal arquivada: ${found.name}`,
          metadata: { proposalId: id },
        },
        user.id,
      );
    }

    return archived;
  }
}
