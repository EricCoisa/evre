import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

@Injectable()
export class CancelApprovalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(
    projectId: string,
    approvalId: string,
    _user: AuthenticatedUser,
  ) {
    const approval = await this.prisma.milestoneApproval.findUnique({
      where: { id: approvalId },
      include: { milestone: { select: { projectId: true } } },
    });
    if (!approval || approval.milestone.projectId !== projectId) {
      throw new NotFoundException(this.i18n.t('project.approval_not_found'));
    }
    if (approval.status !== 'PENDING') {
      throw new BadRequestException(
        this.i18n.t('project.approval_cannot_cancel'),
      );
    }

    return this.prisma.milestoneApproval.update({
      where: { id: approvalId },
      data: {
        status: 'CANCELLED',
      },
    });
  }
}
