import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { SeriesResponse } from 'src/domain/page-builder/page-source.types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Agrega os cadastros de usuário por dia, no shape series do PageBuilder. */
@Injectable()
export class GetSignupsSeriesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(days: number): Promise<SeriesResponse> {
    const start = startOfDay(new Date(Date.now() - (days - 1) * DAY_MS));

    const rows = await this.prisma.user.findMany({
      where: { deletedAt: null, createdAt: { gte: start } },
      select: { createdAt: true },
    });

    const counts = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      counts.set(isoDay(new Date(start.getTime() + i * DAY_MS)), 0);
    }
    for (const row of rows) {
      const day = isoDay(row.createdAt);
      // Guarda o dia fora da janela (borda de fuso/relógio) em vez de criar uma chave nova
      // que quebraria a ordem cronológica da série.
      if (counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
    }

    return {
      data: [...counts.entries()].map(([date, value]) => ({ date, value })),
    };
  }
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
