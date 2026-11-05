import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { ReorderDto } from '../dto/reorder.dto';
import { FindOneProjectUseCase } from './find-one.use-case';

// ponytail: reescreve position de todas as milestones — O(n) com n < 20 colunas, ok
@Injectable()
export class ReorderMilestonesUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly findOne: FindOneProjectUseCase,
  ) {}

  async execute(projectId: string, dto: ReorderDto, user: AuthenticatedUser) {
    await this.findOne.execute(projectId, user);

    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.projectMilestone.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
  }
}
