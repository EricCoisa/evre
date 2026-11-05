import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { ReorderDto } from '../dto/reorder.dto';
import { FindOneProjectUseCase } from './find-one.use-case';

// ponytail: reescreve position de todos os tasks da milestone — O(n) com n < 50, ok
@Injectable()
export class ReorderTasksUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly findOne: FindOneProjectUseCase,
  ) {}

  async execute(
    projectId: string,
    milestoneId: string,
    dto: ReorderDto,
    user: AuthenticatedUser,
  ) {
    await this.findOne.execute(projectId, user);

    const milestone = await this.prisma.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!milestone) {
      throw new NotFoundException(this.i18n.t('project.milestone_not_found'));
    }

    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.projectTask.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
  }
}
