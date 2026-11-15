import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { ProjectNotificationType } from 'src/domain/project/project-notification-types.const';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { RequestApprovalDto } from '../dto/request-approval.dto';

@Injectable()
export class RequestApprovalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly notifications: NotificationService,
  ) {}

  async execute(
    projectId: string,
    milestoneId: string,
    dto: RequestApprovalDto | undefined,
    user: AuthenticatedUser,
  ) {
    const milestone = await this.prisma.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
      include: { project: { select: { companyId: true, name: true } } },
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

    const result = await this.prisma.milestoneApproval.create({
      data: {
        milestoneId,
        requestedById: user.id,
        requestNote: dto?.requestNote,
      },
    });

    const members = await this.prisma.membership.findMany({
      where: { companyId: milestone.project.companyId },
      select: { userId: true },
    });
    if (members.length > 0) {
      await this.notifications.notify({
        type: ProjectNotificationType.MILESTONE_APPROVAL_REQUESTED,
        recipients: { userIds: members.map((m) => m.userId) },
        titleKey: 'project.approval_requested_title',
        title: this.i18n.t('project.approval_requested_title'),
        messageKey: 'project.approval_requested_message',
        message: this.i18n.t('project.approval_requested_message', {
          args: { milestone: milestone.title, project: milestone.project.name },
        }),
        payload: { milestoneId, projectId },
        actionUrl: `/project/${projectId}`,
        channels: { whatsapp: true },
      });
    }

    return result;
  }
}
