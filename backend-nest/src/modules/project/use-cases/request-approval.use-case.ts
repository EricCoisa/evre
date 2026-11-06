import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

@Injectable()
export class RequestApprovalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(
    projectId: string,
    milestoneId: string,
    user: AuthenticatedUser,
  ) {
    const milestone = await this.prisma.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!milestone) {
      throw new NotFoundException(this.i18n.t('project.milestone_not_found'));
    }

    return this.prisma.milestoneApproval.create({
      data: {
        milestoneId,
        requestedById: user.id,
      },
    });
  }
}
