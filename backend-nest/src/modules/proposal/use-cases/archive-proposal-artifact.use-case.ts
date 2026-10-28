import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import type { ProposalArtifact } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindOneProposalUseCase } from './find-one.use-case';

/** Arquiva um artefato da proposta; nunca apaga a linha nem a chave no storage — a versão
 * publicada pode continuar apontando para ela. */
@Injectable()
export class ArchiveProposalArtifactUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly findOne: FindOneProposalUseCase,
  ) {}

  async execute(
    proposalId: string,
    artifactId: string,
    user: AuthenticatedUser,
  ): Promise<ProposalArtifact> {
    const proposal = await this.findOne.execute(proposalId, user);

    const found = await this.prisma.proposalArtifact.findFirst({
      where: { id: artifactId, proposalId: proposal.id },
    });
    if (!found) {
      throw new NotFoundException(this.i18n.t('proposal.artifact.not_found'));
    }

    const archived = found.archivedAt
      ? found
      : await this.prisma.proposalArtifact.update({
          where: { id: artifactId },
          data: { archivedAt: new Date() },
        });

    if (!found.archivedAt) {
      await this.loggingService.create(
        {
          module: 'PROPOSAL',
          action: LogActions.ARCHIVE,
          message: `Artefato arquivado da proposal: ${found.fileName}`,
          metadata: { proposalId: proposal.id, artifactId },
        },
        user.id,
      );
    }

    return archived;
  }
}
