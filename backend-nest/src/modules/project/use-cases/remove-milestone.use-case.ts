import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindOneProjectUseCase } from './find-one.use-case';

@Injectable()
export class RemoveMilestoneUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly i18n: I18nService,
    private readonly findOne: FindOneProjectUseCase,
  ) {}

  async execute(
    projectId: string,
    milestoneId: string,
    user: AuthenticatedUser,
  ) {
    await this.findOne.execute(projectId, user);

    const milestone = await this.prisma.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!milestone) {
      throw new NotFoundException(this.i18n.t('project.milestone_not_found'));
    }

    await this.prisma.projectMilestone.delete({ where: { id: milestoneId } });

    await this.loggingService.create(
      {
        module: 'PROJECT',
        action: LogActions.DELETE,
        message: `Milestone removida: ${milestone.title}`,
        metadata: { projectId, milestoneId },
      },
      user.id,
    );

    return milestone;
  }
}
