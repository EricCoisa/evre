import { BadRequestException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import {
  ProposalStatusConst,
  type ProposalStatusValue,
} from 'src/domain/proposal/proposalStatus.const';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { Proposal } from 'src/domain/proposal/proposal.entity';
import type { UpdateProposalStatusDto } from '../dto/update-proposal-status.dto';
import { FindOneProposalUseCase } from './find-one.use-case';

// ponytail: regra mínima de transição — ACCEPTED/LOST são terminais, o resto é livre entre si.
// Matriz completa (ex. impedir DRAFT -> ACCEPTED direto) fica para quando F1-05/F1-07 exigirem.
const TERMINAL_STATUSES: ProposalStatusValue[] = [
  ProposalStatusConst.ACCEPTED,
  ProposalStatusConst.LOST,
];

@Injectable()
export class UpdateProposalStatusUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly findOne: FindOneProposalUseCase,
  ) {}

  async execute(
    id: string,
    dto: UpdateProposalStatusDto,
    user: AuthenticatedUser,
  ): Promise<Proposal> {
    const found = await this.findOne.execute(id, user);
    const nextStatus = dto.status as ProposalStatusValue;

    if (
      TERMINAL_STATUSES.includes(found.status) &&
      nextStatus !== found.status
    ) {
      throw new BadRequestException(
        this.i18n.t('proposal.invalid_status_transition'),
      );
    }

    if (nextStatus === ProposalStatusConst.LOST && !dto.lostReason) {
      throw new BadRequestException(
        this.i18n.t('proposal.lost_reason_required'),
      );
    }

    const updated = await this.prisma.proposal.update({
      where: { id },
      data: {
        status: nextStatus,
        lostReason:
          nextStatus === ProposalStatusConst.LOST ? dto.lostReason : null,
      },
    });

    await this.loggingService.create(
      {
        module: 'PROPOSAL',
        action: LogActions.UPDATE,
        message: `Status da proposal alterado para ${nextStatus}: ${updated.name}`,
        metadata: { proposalId: id, status: nextStatus },
      },
      user.id,
    );

    return updated as unknown as Proposal;
  }
}
