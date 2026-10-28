import { BadRequestException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { ProposalStatusConst } from 'src/domain/proposal/proposalStatus.const';
import type { ProposalRecurrenceValue } from 'src/domain/proposal/proposalRecurrence.const';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { Proposal } from 'src/domain/proposal/proposal.entity';
import type { UpdateProposalTermsDto } from '../dto/update-proposal-terms.dto';
import { FindOneProposalUseCase } from './find-one.use-case';

/** Envelope comercial (rascunho) — só grava enquanto a proposta está em DRAFT. */
@Injectable()
export class UpdateProposalTermsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly findOne: FindOneProposalUseCase,
  ) {}

  async execute(
    id: string,
    dto: UpdateProposalTermsDto,
    user: AuthenticatedUser,
  ): Promise<Proposal> {
    const found = await this.findOne.execute(id, user);

    if (found.status !== ProposalStatusConst.DRAFT) {
      throw new BadRequestException(
        this.i18n.t('proposal.cannot_edit_non_draft'),
      );
    }

    const updated = await this.prisma.proposal.update({
      where: { id },
      data: {
        ...dto,
        recurrence: dto.recurrence as ProposalRecurrenceValue | undefined,
      },
    });

    await this.loggingService.create(
      {
        module: 'PROPOSAL',
        action: LogActions.UPDATE,
        message: `Envelope da proposal atualizado: ${updated.name}`,
        metadata: { proposalId: id },
      },
      user.id,
    );

    return updated as unknown as Proposal;
  }
}
