import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import { NotificationService } from '../../notification/notification.service';
import { ProjectNotificationType } from 'src/domain/project/project-notification-types.const';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { CreateCommentDto } from '../dto/create-comment.dto';

@Injectable()
export class CreateCommentUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly resourceAccess: ResourceAccessService,
    private readonly notifications: NotificationService,
  ) {}

  async execute(
    projectId: string,
    dto: CreateCommentDto,
    user: AuthenticatedUser,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, companyId: true },
    });
    if (!project) {
      throw new NotFoundException(this.i18n.t('project.not_found'));
    }
    await this.resourceAccess.assertCanRead(user, {
      companyId: project.companyId,
      projectId,
    });

    await this.validateEntity(projectId, dto.entityType, dto.entityId);

    const comment = await this.prisma.projectComment.create({
      data: {
        projectId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        content: dto.content,
        authorId: user.id,
      },
    });

    if (dto.entityType === 'TASK') {
      const task = await this.prisma.projectTask.findFirst({
        where: { id: dto.entityId },
        select: { assigneeId: true, title: true },
      });
      if (task?.assigneeId && task.assigneeId !== user.id) {
        await this.notifications.notify({
          type: ProjectNotificationType.TASK_COMMENTED,
          recipients: { userIds: [task.assigneeId] },
          titleKey: 'project.task_commented_title',
          title: this.i18n.t('project.task_commented_title'),
          messageKey: 'project.task_commented_message',
          message: this.i18n.t('project.task_commented_message', {
            args: { title: task.title },
          }),
          payload: { taskId: dto.entityId, projectId },
          actionUrl: `/project/${projectId}`,
        });
      }
    }

    return comment;
  }

  private async validateEntity(
    projectId: string,
    entityType: string,
    entityId: string,
  ) {
    if (entityType === 'PROJECT') {
      if (entityId !== projectId) {
        throw new NotFoundException(this.i18n.t('project.not_found'));
      }
      return;
    }
    if (entityType === 'MILESTONE') {
      const m = await this.prisma.projectMilestone.findFirst({
        where: { id: entityId, projectId },
      });
      if (!m)
        throw new NotFoundException(this.i18n.t('project.milestone_not_found'));
      return;
    }
    const t = await this.prisma.projectTask.findFirst({
      where: {
        id: entityId,
        milestone: { projectId },
      },
    });
    if (!t) throw new NotFoundException(this.i18n.t('project.task_not_found'));
  }
}
