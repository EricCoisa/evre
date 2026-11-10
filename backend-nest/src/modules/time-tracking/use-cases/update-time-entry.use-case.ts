import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggingService } from 'src/modules/logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { UpdateTimeEntryDto } from '../dto/update-time-entry.dto';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

@Injectable()
export class UpdateTimeEntryUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logging: LoggingService,
    private readonly i18n: I18nService,
  ) {}

  async execute(id: string, dto: UpdateTimeEntryDto, user: AuthenticatedUser) {
    const existing = await this.prisma.timeEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(this.i18n.t('time_tracking.errors.not_found'));
    }

    if (user.roleName !== 'ADMIN' && existing.userId !== user.id) {
      throw new ForbiddenException(
        this.i18n.t('time_tracking.errors.forbidden_edit'),
      );
    }

    const newStartTime = dto.startTime
      ? new Date(dto.startTime)
      : existing.startTime;
    const newEndTime =
      dto.endTime !== undefined
        ? dto.endTime
          ? new Date(dto.endTime)
          : null
        : existing.endTime;

    let newDuration = existing.duration;
    if (newEndTime && newStartTime) {
      if (newEndTime.getTime() <= newStartTime.getTime()) {
        throw new BadRequestException(
          this.i18n.t('time_tracking.errors.end_before_start'),
        );
      }
      newDuration = Math.round(
        (newEndTime.getTime() - newStartTime.getTime()) / 1000,
      );
    } else if (!newEndTime) {
      newDuration = null;
    }

    const now = new Date();

    const updated = await this.prisma.timeEntry.update({
      where: { id },
      data: {
        description:
          dto.description !== undefined
            ? dto.description
            : existing.description,
        startTime: newStartTime,
        endTime: newEndTime,
        duration: newDuration,
        isBillable:
          dto.isBillable != null ? dto.isBillable : existing.isBillable,
        projectId:
          dto.projectId !== undefined ? dto.projectId : existing.projectId,
        entityType:
          dto.entityType !== undefined ? dto.entityType : existing.entityType,
        entityId: dto.entityId !== undefined ? dto.entityId : existing.entityId,
        entityTitle:
          dto.entityTitle !== undefined
            ? dto.entityTitle
            : existing.entityTitle,
        isManual: true,
        editedById: user.id,
        editedAt: now,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
        editedBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Auditoria via LoggingService
    await this.logging.create(
      {
        module: 'TIME_TRACKING',
        action: LogActions.UPDATE,
        message: `Registro de tempo ${id} editado manualmente por ${user.email ?? user.id}`,
        metadata: {
          entryId: id,
          previous: {
            description: existing.description,
            startTime: existing.startTime,
            endTime: existing.endTime,
            duration: existing.duration,
            isBillable: existing.isBillable,
            projectId: existing.projectId,
          },
          updated: {
            description: updated.description,
            startTime: updated.startTime,
            endTime: updated.endTime,
            duration: updated.duration,
            isBillable: updated.isBillable,
            projectId: updated.projectId,
          },
        },
      },
      user.id,
    );

    return updated;
  }
}
