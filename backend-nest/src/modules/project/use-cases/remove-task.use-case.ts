import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindOneProjectUseCase } from './find-one.use-case';

@Injectable()
export class RemoveTaskUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly i18n: I18nService,
    private readonly findOne: FindOneProjectUseCase,
  ) {}

  async execute(
    projectId: string,
    taskId: string,
    user: AuthenticatedUser,
  ) {
    await this.findOne.execute(projectId, user);

    const task = await this.prisma.projectTask.findFirst({
      where: { id: taskId, milestone: { projectId } },
    });
    if (!task) {
      throw new NotFoundException(this.i18n.t('project.task_not_found'));
    }

    await this.prisma.projectTask.delete({ where: { id: taskId } });

    await this.loggingService.create(
      {
        module: 'PROJECT',
        action: LogActions.DELETE,
        message: `Task removida: ${task.title}`,
        metadata: { projectId, taskId },
      },
      user.id,
    );

    return task;
  }
}
