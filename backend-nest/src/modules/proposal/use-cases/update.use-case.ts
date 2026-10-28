import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { Proposal } from 'src/domain/proposal/proposal.entity';
import type { UpdateProposalDto } from '../dto/update-proposal.dto';
import { FindOneProposalUseCase } from './find-one.use-case';

@Injectable()
export class UpdateProposalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly findOne: FindOneProposalUseCase,
  ) {}

  async execute(
    id: string,
    dto: UpdateProposalDto,
    user: AuthenticatedUser,
  ): Promise<Proposal> {
    // Prisma num id inexistente estoura P2025 (500, não 404); findOne também cobre o acesso por escopo.
    await this.findOne.execute(id, user);

    const updated = await this.prisma.proposal.update({
      where: { id },
      data: { ...dto },
    });

    await this.loggingService.create(
      {
        module: 'PROPOSAL',
        action: LogActions.UPDATE,
        message: `Proposal atualizada: ${updated.name}`,
        metadata: { proposalId: id },
      },
      user.id,
    );

    return updated as unknown as Proposal;
  }
}
