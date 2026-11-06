import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { RequestApprovalDto } from '../dto/request-approval.dto';

@Injectable()
export class RequestApprovalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(
    projectId: string,
    milestoneId: string,
    dto: RequestApprovalDto | undefined,
    user: AuthenticatedUser,
  ) {
    const milestone = await this.prisma.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!milestone) {
      throw new NotFoundException(this.i18n.t('project.milestone_not_found'));
    }

    const existingPending = await this.prisma.milestoneApproval.findFirst({
      where: { milestoneId, status: 'PENDING' },
    });
    if (existingPending) {
      if (dto?.requestNote !== undefined) {
        return this.prisma.milestoneApproval.update({
          where: { id: existingPending.id },
          data: { requestNote: dto.requestNote },
        });
      }
      return existingPending;
    }

    return this.prisma.milestoneApproval.create({
      data: {
        milestoneId,
        requestedById: user.id,
        requestNote: dto?.requestNote,
      },
    });
  }
}
