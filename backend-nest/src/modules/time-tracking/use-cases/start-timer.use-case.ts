import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { StartTimerDto } from '../dto/start-timer.dto';

@Injectable()
export class StartTimerUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string, dto: StartTimerDto) {
    const now = new Date();

    let resolvedProjectId = dto.projectId;
    let resolvedTitle = dto.entityTitle;

    // Se vinculado a uma TASK e sem projectId ou entityTitle explícitos, busca para auto-preenchimento
    if (
      dto.entityType === 'TASK' &&
      dto.entityId &&
      (!resolvedProjectId || !resolvedTitle)
    ) {
      const task = await this.prisma.projectTask.findUnique({
        where: { id: dto.entityId },
        include: {
          milestone: {
            select: { projectId: true },
          },
        },
      });

      if (task) {
        if (!resolvedProjectId) resolvedProjectId = task.milestone.projectId;
        if (!resolvedTitle) resolvedTitle = task.title;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Busca e finaliza qualquer timer ativo concorrente do usuário (switch automático)
      const activeTimer = await tx.timeEntry.findFirst({
        where: {
          userId,
          endTime: null,
        },
      });

      if (activeTimer) {
        const duration = Math.max(
          0,
          Math.round((now.getTime() - activeTimer.startTime.getTime()) / 1000),
        );
        await tx.timeEntry.update({
          where: { id: activeTimer.id },
          data: {
            endTime: now,
            duration,
          },
        });
      }

      // 2. Inicia o novo timer
      return tx.timeEntry.create({
        data: {
          userId,
          description: dto.description ?? resolvedTitle ?? null,
          isBillable: dto.isBillable ?? true,
          startTime: now,
          source: 'TIMER',
          entityType: dto.entityType ?? null,
          entityId: dto.entityId ?? null,
          entityTitle: resolvedTitle ?? null,
          projectId: resolvedProjectId ?? null,
        },
        include: {
          project: {
            select: { id: true, name: true },
          },
        },
      });
    });
  }
}
