import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class StopTimerUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string) {
    const activeTimer = await this.prisma.timeEntry.findFirst({
      where: {
        userId,
        endTime: null,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    if (!activeTimer) {
      throw new NotFoundException('Nenhum cronômetro ativo encontrado');
    }

    const now = new Date();
    const duration = Math.max(
      0,
      Math.round((now.getTime() - activeTimer.startTime.getTime()) / 1000),
    );

    return this.prisma.timeEntry.update({
      where: { id: activeTimer.id },
      data: {
        endTime: now,
        duration,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });
  }
}
