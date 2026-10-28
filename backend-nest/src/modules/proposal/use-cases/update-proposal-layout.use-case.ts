import { BadRequestException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { ProposalStatusConst } from 'src/domain/proposal/proposalStatus.const';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { Proposal } from 'src/domain/proposal/proposal.entity';
import type { UpdateProposalLayoutDto } from '../dto/update-proposal-layout.dto';
import { FindOneProposalUseCase } from './find-one.use-case';

/** Rascunho do layout do PageBuilder — só grava enquanto a proposta está em DRAFT. */
@Injectable()
export class UpdateProposalLayoutUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly findOne: FindOneProposalUseCase,
  ) {}

  async execute(
    id: string,
    dto: UpdateProposalLayoutDto,
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
      data: { layout: dto.layout as Prisma.InputJsonValue },
    });

    await this.loggingService.create(
      {
        module: 'PROPOSAL',
        action: LogActions.UPDATE,
        message: `Layout da proposal atualizado: ${updated.name}`,
        metadata: { proposalId: id },
      },
      user.id,
    );

    return updated as unknown as Proposal;
  }
}
