import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { MoveTaskDto } from '../dto/move-task.dto';
import { FindOneProjectUseCase } from './find-one.use-case';

@Injectable()
export class MoveTaskUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly findOne: FindOneProjectUseCase,
  ) {}

  async execute(
    projectId: string,
    taskId: string,
    dto: MoveTaskDto,
    user: AuthenticatedUser,
  ) {
    await this.findOne.execute(projectId, user);

    const task = await this.prisma.projectTask.findFirst({
      where: { id: taskId, milestone: { projectId } },
    });
    if (!task) {
      throw new NotFoundException(this.i18n.t('project.task_not_found'));
    }

    const targetMilestone = await this.prisma.projectMilestone.findFirst({
      where: { id: dto.milestoneId, projectId },
    });
    if (!targetMilestone) {
      throw new NotFoundException(this.i18n.t('project.milestone_not_found'));
    }

    // ponytail: reescreve position de todos os tasks na milestone destino — O(n) com n < 50, ok
    return this.prisma.$transaction(async (tx) => {
      // Abrir espaço na posição destino
      await tx.projectTask.updateMany({
        where: {
          milestoneId: dto.milestoneId,
          position: { gte: dto.position },
        },
        data: { position: { increment: 1 } },
      });

      return tx.projectTask.update({
        where: { id: taskId },
        data: { milestoneId: dto.milestoneId, position: dto.position },
      });
    });
  }
}
