import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindOneProposalUseCase } from './find-one.use-case';

export interface RevokeProposalPublicationOutput {
  proposalId: string;
  version: number | null;
  revokedAt: Date | null;
  alreadyRevoked: boolean;
  message?: string;
}

/** Marca `revokedAt` na versão vigente. Idempotente: revogar o já revogado não é erro. */
@Injectable()
export class RevokeProposalPublicationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly findOne: FindOneProposalUseCase,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<RevokeProposalPublicationOutput> {
    await this.findOne.execute(id, user);

    const active = await this.prisma.proposalVersion.findFirst({
      where: { proposalId: id, publicToken: { not: null }, revokedAt: null },
      orderBy: { version: 'desc' },
    });

    if (active) {
      const revoked = await this.prisma.proposalVersion.update({
        where: { id: active.id },
        data: { revokedAt: new Date() },
      });

      await this.loggingService.create(
        {
          module: 'PROPOSAL',
          action: LogActions.REVOKE,
          message: `Publicação da proposal revogada (v${revoked.version})`,
          metadata: { proposalId: id, version: revoked.version },
        },
        user.id,
      );

      return {
        proposalId: id,
        version: revoked.version,
        revokedAt: revoked.revokedAt,
        alreadyRevoked: false,
      };
    }

    const latest = await this.prisma.proposalVersion.findFirst({
      where: { proposalId: id },
      orderBy: { version: 'desc' },
    });

    if (!latest) {
      throw new NotFoundException(this.i18n.t('proposal.version_not_found'));
    }

    return {
      proposalId: id,
      version: latest.version,
      revokedAt: latest.revokedAt,
      alreadyRevoked: true,
      message: this.i18n.t('proposal.already_revoked'),
    };
  }
}
