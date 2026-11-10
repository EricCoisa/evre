import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggingService } from 'src/modules/logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { CreateManualEntryDto } from '../dto/create-manual-entry.dto';

@Injectable()
export class CreateManualEntryUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logging: LoggingService,
  ) {}

  async execute(userId: string, dto: CreateManualEntryDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException(
        'A hora de término deve ser posterior à hora de início',
      );
    }

    const duration = Math.round((end.getTime() - start.getTime()) / 1000);
    const now = new Date();

    const entry = await this.prisma.timeEntry.create({
      data: {
        userId,
        description: dto.description ?? dto.entityTitle ?? null,
        startTime: start,
        endTime: end,
        duration,
        isBillable: dto.isBillable ?? true,
        source: 'MANUAL',
        isManual: true,
        editedById: userId,
        editedAt: now,
        entityType: dto.entityType ?? null,
        entityId: dto.entityId ?? null,
        entityTitle: dto.entityTitle ?? null,
        projectId: dto.projectId ?? null,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await this.logging.create(
      {
        module: 'TIME_TRACKING',
        action: LogActions.CREATE,
        message: `Lançamento manual de horas criado para o usuário ${userId}`,
        metadata: {
          entryId: entry.id,
          duration,
          startTime: entry.startTime,
          endTime: entry.endTime,
          description: entry.description,
        },
      },
      userId,
    );

    return entry;
  }
}
