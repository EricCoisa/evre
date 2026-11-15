import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { ProjectNotificationType } from 'src/domain/project/project-notification-types.const';
import { NOTIFICATION_DEBOUNCE_DELAY_MS } from '../../notification/notification-debounce.const';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { UpdateTaskDto } from '../dto/update-task.dto';
import { FindOneProjectUseCase } from './find-one.use-case';

@Injectable()
export class UpdateTaskUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly findOne: FindOneProjectUseCase,
    private readonly notifications: NotificationService,
  ) {}

  async execute(
    projectId: string,
    taskId: string,
    dto: UpdateTaskDto,
    user: AuthenticatedUser,
  ) {
    await this.findOne.execute(projectId, user);

    const task = await this.prisma.projectTask.findFirst({
      where: { id: taskId, milestone: { projectId } },
    });
    if (!task) {
      throw new NotFoundException(this.i18n.t('project.task_not_found'));
    }

    const updateData = { ...dto };
    if (
      dto.status &&
      dto.status !== 'BLOCKED' &&
      dto.blockedReason === undefined
    ) {
      updateData.blockedReason = null;
    }

    const updated = await this.prisma.projectTask.update({
      where: { id: taskId },
      data: updateData,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, imageUrl: true },
        },
      },
    });

    const newAssigneeId = dto.assigneeId;
    if (
      newAssigneeId !== undefined &&
      newAssigneeId !== null &&
      newAssigneeId !== task.assigneeId &&
      newAssigneeId !== user.id
    ) {
      await this.notifications.notifyDebounced({
        bufferKey: `notif-debounce:task-assigned:${newAssigneeId}`,
        delayMs: NOTIFICATION_DEBOUNCE_DELAY_MS,
        item: task.title,
        recipientUserId: newAssigneeId,
        type: ProjectNotificationType.TASK_ASSIGNED,
        titleKey: 'project.task_assigned_title',
        messageKey: 'project.task_assigned_message',
        actionUrl: `/project/${projectId}`,
      });
    }

    return updated;
  }
}
