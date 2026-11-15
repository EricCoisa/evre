import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import { NotificationService } from '../../notification/notification.service';
import { ProjectNotificationType } from 'src/domain/project/project-notification-types.const';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { RespondApprovalDto } from '../dto/respond-approval.dto';

@Injectable()
export class RespondApprovalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly resourceAccess: ResourceAccessService,
    private readonly notifications: NotificationService,
  ) {}

  async execute(
    projectId: string,
    approvalId: string,
    dto: RespondApprovalDto,
    user: AuthenticatedUser,
  ) {
    const approval = await this.prisma.milestoneApproval.findUnique({
      where: { id: approvalId },
      include: {
        milestone: { select: { projectId: true, title: true } },
      },
    });
    if (!approval || approval.milestone.projectId !== projectId) {
      throw new NotFoundException(this.i18n.t('project.approval_not_found'));
    }
    if (approval.status !== 'PENDING') {
      throw new BadRequestException(
        this.i18n.t('project.approval_already_responded'),
      );
    }

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { companyId: true },
    });
    await this.resourceAccess.assertCanRead(user, {
      companyId: project.companyId,
      projectId,
    });

    const updated = await this.prisma.milestoneApproval.update({
      where: { id: approvalId },
      data: {
        status: dto.status,
        respondedById: user.id,
        responseNote: dto.responseNote,
        respondedAt: new Date(),
      },
    });

    const approved = dto.status === 'APPROVED';
    await this.notifications.notify({
      type: ProjectNotificationType.MILESTONE_APPROVAL_RESPONDED,
      recipients: { userIds: [approval.requestedById] },
      titleKey: approved
        ? 'project.approval_approved_title'
        : 'project.approval_rejected_title',
      title: this.i18n.t(
        approved
          ? 'project.approval_approved_title'
          : 'project.approval_rejected_title',
      ),
      messageKey: approved
        ? 'project.approval_approved_message'
        : 'project.approval_rejected_message',
      message: this.i18n.t(
        approved
          ? 'project.approval_approved_message'
          : 'project.approval_rejected_message',
        { args: { milestone: approval.milestone.title } },
      ),
      payload: {
        approvalId,
        milestoneId: approval.milestoneId,
        projectId,
        status: dto.status,
        milestone: approval.milestone.title,
      },
      actionUrl: `/project/${projectId}`,
      channels: { whatsapp: true },
    });

    return updated;
  }
}
