import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { Proposal } from 'src/domain/proposal/proposal.entity';
import type { CreateProposalDto } from '../dto/create-proposal.dto';

@Injectable()
export class CreateProposalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(dto: CreateProposalDto, ownerId: string): Promise<Proposal> {
    const created = await this.prisma.proposal.create({
      data: { name: dto.name, ownerId },
    });

    await this.loggingService.create(
      {
        module: 'PROPOSAL',
        action: LogActions.CREATE,
        message: `Proposal criada: ${created.name}`,
        metadata: { proposalId: created.id },
      },
      ownerId,
    );

    return created as unknown as Proposal;
  }
}
