import { ConflictException, Injectable } from '@nestjs/common';
import type { Company } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { ProposalStatusConst } from 'src/domain/proposal/proposalStatus.const';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindOneCompanyUseCase } from './find-one.use-case';

/** "Remover" uma empresa é arquivar — nada é apagado (histórico de propostas/contratos depende dela).
 * Recusa se houver proposta em andamento (`DRAFT`/`SENT`/`ACCEPTED`, não arquivada) — arquivar a
 * empresa não pode deixar negócio em curso sem dono visível.
 * // ponytail: só Proposal existe hoje. Projeto/Contrato entram na mesma checagem quando F2
 * // criar esses models — mesmo princípio, mais um OR na query. */
@Injectable()
export class RemoveCompanyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly i18n: I18nService,
    private readonly findOne: FindOneCompanyUseCase,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<Company> {
    const found = await this.findOne.execute(id, user);

    if (!found.archivedAt) {
      const activeProposal = await this.prisma.proposal.findFirst({
        where: {
          companyId: id,
          archivedAt: null,
          status: {
            in: [
              ProposalStatusConst.DRAFT,
              ProposalStatusConst.SENT,
              ProposalStatusConst.ACCEPTED,
            ],
          },
        },
        select: { id: true },
      });
      if (activeProposal) {
        throw new ConflictException(
          this.i18n.t('company.cannot_archive_with_active_proposals'),
        );
      }
    }

    const archived = found.archivedAt
      ? found
      : await this.prisma.company.update({
          where: { id },
          data: { archivedAt: new Date() },
        });

    if (!found.archivedAt) {
      await this.loggingService.create(
        {
          module: 'COMPANY',
          action: LogActions.ARCHIVE,
          message: `Company arquivado: ${found.name}`,
          metadata: { companyId: id },
        },
        user.id,
      );
    }

    return archived;
  }
}
