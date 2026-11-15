import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { NotificationService } from '../../notification/notification.service';
import { ProjectNotificationType } from 'src/domain/project/project-notification-types.const';
import { NOTIFICATION_DEBOUNCE_DELAY_MS } from '../../notification/notification-debounce.const';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { CreateTaskDto } from '../dto/create-task.dto';
import { FindOneProjectUseCase } from './find-one.use-case';

@Injectable()
export class CreateTaskUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly i18n: I18nService,
    private readonly findOne: FindOneProjectUseCase,
    private readonly notifications: NotificationService,
  ) {}

  async execute(
    projectId: string,
    milestoneId: string,
    dto: CreateTaskDto,
    user: AuthenticatedUser,
  ) {
    await this.findOne.execute(projectId, user);

    const milestone = await this.prisma.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!milestone) {
      throw new NotFoundException(this.i18n.t('project.milestone_not_found'));
    }

    const maxPos = await this.prisma.projectTask.aggregate({
      where: { milestoneId },
      _max: { position: true },
    });

    const assigneeId = dto.assigneeId !== undefined ? dto.assigneeId : user.id;
    const created = await this.prisma.projectTask.create({
      data: {
        milestoneId,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? 'WAITING',
        blockedReason: dto.status === 'BLOCKED' ? dto.blockedReason : null,
        assigneeId,
        position: (maxPos._max.position ?? -1) + 1,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, imageUrl: true },
        },
      },
    });

    await this.loggingService.create(
      {
        module: 'PROJECT',
        action: LogActions.CREATE,
        message: `Task criada: ${created.title}`,
        metadata: { projectId, milestoneId, taskId: created.id },
      },
      user.id,
    );

    if (assigneeId && assigneeId !== user.id) {
      await this.notifications.notifyDebounced({
        bufferKey: `notif-debounce:task-assigned:${assigneeId}`,
        delayMs: NOTIFICATION_DEBOUNCE_DELAY_MS,
        item: created.title,
        recipientUserId: assigneeId,
        type: ProjectNotificationType.TASK_ASSIGNED,
        titleKey: 'project.task_assigned_title',
        messageKey: 'project.task_assigned_message',
        actionUrl: `/project/${projectId}`,
      });
    }

    return created;
  }
}
