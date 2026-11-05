import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { UpdateMilestoneDto } from '../dto/update-milestone.dto';
import { FindOneProjectUseCase } from './find-one.use-case';

@Injectable()
export class UpdateMilestoneUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly findOne: FindOneProjectUseCase,
  ) {}

  async execute(
    projectId: string,
    milestoneId: string,
    dto: UpdateMilestoneDto,
    user: AuthenticatedUser,
  ) {
    await this.findOne.execute(projectId, user);

    const milestone = await this.prisma.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!milestone) {
      throw new NotFoundException(this.i18n.t('project.milestone_not_found'));
    }

    return this.prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: { ...dto },
    });
  }
}
