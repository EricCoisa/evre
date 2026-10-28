import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { Proposal } from 'src/domain/proposal/proposal.entity';
import { FindOneProposalUseCase } from './find-one.use-case';

/** Alavanca de produtividade nº 1: copia nome, layout e envelope; nasce DRAFT, sem versão, sem token. */
@Injectable()
export class DuplicateProposalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly findOne: FindOneProposalUseCase,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<Proposal> {
    const found = await this.findOne.execute(id, user);

    const duplicated = await this.prisma.proposal.create({
      data: {
        name: `${found.name} (cópia)`,
        ownerId: user.id,
        companyId: found.companyId,
        layout: (found.layout ?? undefined) as
          Prisma.InputJsonValue | undefined,
        totalCents: found.totalCents,
        currency: found.currency,
        recurrence: found.recurrence,
        termDays: found.termDays,
        validUntil: found.validUntil,
        includedItems: found.includedItems,
        optionalItems: found.optionalItems,
      },
    });

    await this.loggingService.create(
      {
        module: 'PROPOSAL',
        action: LogActions.CREATE,
        message: `Proposal duplicada a partir de ${found.id}: ${duplicated.name}`,
        metadata: { proposalId: duplicated.id, sourceProposalId: found.id },
      },
      user.id,
    );

    return duplicated as unknown as Proposal;
  }
}
