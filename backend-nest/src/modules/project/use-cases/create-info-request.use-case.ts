import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { ProjectNotificationType } from 'src/domain/project/project-notification-types.const';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { CreateInfoRequestDto } from '../dto/create-info-request.dto';

@Injectable()
export class CreateInfoRequestUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly notifications: NotificationService,
  ) {}

  async execute(
    projectId: string,
    dto: CreateInfoRequestDto,
    user: AuthenticatedUser,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, companyId: true, name: true },
    });
    if (!project) {
      throw new NotFoundException(this.i18n.t('project.not_found'));
    }

    const created = await this.prisma.projectInfoRequest.create({
      data: {
        projectId,
        label: dto.label,
        description: dto.description,
        requestedById: user.id,
      },
    });

    const members = await this.prisma.membership.findMany({
      where: { companyId: project.companyId },
      select: { userId: true },
    });
    const recipientIds = members
      .map((m) => m.userId)
      .filter((id) => id !== user.id);
    if (recipientIds.length > 0) {
      await this.notifications.notify({
        type: ProjectNotificationType.INFO_REQUEST_CREATED,
        recipients: { userIds: recipientIds },
        titleKey: 'project.info_request_created_title',
        title: this.i18n.t('project.info_request_created_title'),
        messageKey: 'project.info_request_created_message',
        message: this.i18n.t('project.info_request_created_message', {
          args: { project: project.name, label: dto.label },
        }),
        payload: {
          projectId,
          infoRequestId: created.id,
          project: project.name,
          label: dto.label,
        },
        actionUrl: `/project/${projectId}`,
        channels: { whatsapp: true },
      });
    }

    return created;
  }
}
