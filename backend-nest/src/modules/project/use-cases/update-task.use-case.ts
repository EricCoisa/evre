import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { UpdateTaskDto } from '../dto/update-task.dto';
import { FindOneProjectUseCase } from './find-one.use-case';

@Injectable()
export class UpdateTaskUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly findOne: FindOneProjectUseCase,
  ) {}

  async execute(
    projectId: string,
    taskId: string,
    dto: UpdateTaskDto,
    user: AuthenticatedUser,
  ) {
    await this.findOne.execute(projectId, user);

    const task = await this.prisma.projectTask.findFirst({
      where: { id: taskId, milestone: { projectId } },
    });
    if (!task) {
      throw new NotFoundException(this.i18n.t('project.task_not_found'));
    }

    const updateData = { ...dto };
    if (dto.status && dto.status !== 'BLOCKED' && dto.blockedReason === undefined) {
      updateData.blockedReason = null;
    }

    return this.prisma.projectTask.update({
      where: { id: taskId },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, email: true, imageUrl: true } },
      },
    });
  }
}
