import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import {
  TIME_TRACKING_CONFIG_KEYS,
  TIME_TRACKING_DEFAULT_FORGOTTEN_THRESHOLD_HOURS,
} from 'src/domain/time-tracking/time-tracking.const';
import type { ListTimeEntriesDto } from '../dto/list-time-entries.dto';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import dayjs from 'dayjs';

function escapeCsv(val: unknown): string {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDurationHms(seconds: number): string {
  if (seconds < 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

@Injectable()
export class ExportTimeEntriesUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigurationService,
  ) {}

  async execute(dto: ListTimeEntriesDto, user: AuthenticatedUser) {
    const where: Prisma.TimeEntryWhereInput = {};

    let parsedFilter: Record<string, any> = {};
    if (dto.filter) {
      try {
        parsedFilter = JSON.parse(dto.filter);
      } catch {}
    }

    const resolvedProjectId = dto.projectId || parsedFilter.projectId;
    const resolvedUserId = dto.userId || parsedFilter.userId;
    const resolvedEntityType = dto.entityType || parsedFilter.entityType;
    const resolvedEntityId = dto.entityId || parsedFilter.entityId;

    if (user.roleName !== 'ADMIN') {
      where.userId = user.id;
    } else if (resolvedUserId) {
      where.userId = resolvedUserId;
    }

    if (resolvedProjectId) {
      where.projectId = resolvedProjectId;
    }

    if (resolvedEntityType) {
      where.entityType = resolvedEntityType;
    }

    if (resolvedEntityId) {
      where.entityId = resolvedEntityId;
    }

    if (dto.search) {
      where.OR = [
        { description: { contains: dto.search, mode: 'insensitive' } },
        { entityTitle: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const resolvedStartDate = dto.startDate || parsedFilter.startDate;
    const resolvedEndDate = dto.endDate || parsedFilter.endDate;

    if (!resolvedStartDate || !resolvedEndDate) {
      throw new BadRequestException(
        'É obrigatório definir a data inicial e final para exportação, com intervalo de no máximo 90 dias.',
      );
    }

    const start = new Date(resolvedStartDate);
    const end = new Date(resolvedEndDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Formato de data inválido.');
    }

    if (start > end) {
      throw new BadRequestException('A data inicial não pode ser posterior à data final.');
    }

    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 90) {
      throw new BadRequestException(
        `O período selecionado para exportação (${diffDays} dias) excede o limite máximo permitido de 90 dias.`,
      );
    }

    const endFilter = typeof resolvedEndDate === 'string' && resolvedEndDate.length === 10
      ? new Date(new Date(resolvedEndDate).setHours(23, 59, 59, 999))
      : end;

    where.startTime = {
      gte: start,
      lte: endFilter,
    };

    let thresholdHours = TIME_TRACKING_DEFAULT_FORGOTTEN_THRESHOLD_HOURS;
    try {
      const configVal = await this.systemConfig.getValueOrNull(
        TIME_TRACKING_CONFIG_KEYS.forgottenThresholdHours,
      );
      if (configVal && !Number.isNaN(Number(configVal))) {
        thresholdHours = Number(configVal);
      }
    } catch {
      thresholdHours = TIME_TRACKING_DEFAULT_FORGOTTEN_THRESHOLD_HOURS;
    }

    const thresholdSeconds = thresholdHours * 3600;
    const nowMs = Date.now();

    const items = await this.prisma.timeEntry.findMany({
      where,
      orderBy: { startTime: 'desc' },
      take: 2000,
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

    const headers = [
      'Data',
      'Início',
      'Término',
      'Duração (Formatada)',
      'Duração (Horas)',
      'Projeto',
      'Descrição / Atividade',
      'Vínculo (Tipo)',
      'Vínculo (Título)',
      'Operador',
      'E-mail Operador',
      'Origem',
      'Auditoria',
      'Alerta Operacional',
    ];

    let totalDurationSeconds = 0;
    let billableSeconds = 0;

    const formattedEntries: Array<{
      id: string;
      date: string;
      startTime: string;
      endTime: string;
      duration: number;
      durationFormatted: string;
      durationHours: string;
      projectName: string;
      description: string;
      entityType: string;
      entityTitle: string;
      userName: string;
      userEmail: string;
      isBillable: boolean;
      source: string;
      isForgotten: boolean;
    }> = [];

    const rows = items.map((item) => {
      let duration = item.duration ?? 0;
      let isForgotten = false;

      if (!item.endTime) {
        duration = Math.max(0, Math.floor((nowMs - new Date(item.startTime).getTime()) / 1000));
        isForgotten = duration >= thresholdSeconds;
      } else {
        isForgotten = duration >= thresholdSeconds;
      }

      totalDurationSeconds += duration;
      if (item.isBillable) {
        billableSeconds += duration;
      }

      const decimalHours = (duration / 3600).toFixed(2).replace('.', ',');
      const startDate = dayjs(item.startTime);
      const endDate = item.endTime ? dayjs(item.endTime) : null;

      formattedEntries.push({
        id: item.id,
        date: startDate.format('DD/MM/YYYY'),
        startTime: startDate.format('HH:mm:ss'),
        endTime: endDate ? endDate.format('HH:mm:ss') : 'Em andamento',
        duration,
        durationFormatted: formatDurationHms(duration),
        durationHours: decimalHours,
        projectName: item.project?.name || 'Avulso',
        description: item.description || '',
        entityType: item.entityType || '',
        entityTitle: item.entityTitle || '',
        userName: item.user?.name || item.user?.email || 'N/A',
        userEmail: item.user?.email || '',
        isBillable: item.isBillable,
        source: item.source === 'MANUAL' || item.isManual ? 'Manual' : 'Cronômetro',
        isForgotten,
      });

      return [
        startDate.format('DD/MM/YYYY'),
        startDate.format('HH:mm:ss'),
        endDate ? endDate.format('HH:mm:ss') : 'Em andamento',
        formatDurationHms(duration),
        decimalHours,
        item.project?.name || 'Avulso',
        item.description || '',
        item.entityType || '',
        item.entityTitle || '',
        item.user?.name || '',
        item.user?.email || '',
        item.source === 'MANUAL' || item.isManual ? 'Manual' : 'Cronômetro',
        item.editedById ? `Editado manualmente por ${item.editedBy?.name || item.editedById}` : 'Original',
        isForgotten ? 'Possível Timer Esquecido' : 'Normal',
      ]
        .map(escapeCsv)
        .join(';');
    });

    const bom = '\uFEFF';
    const csvContent = [headers.join(';'), ...rows].join('\r\n');
    const fullCsv = bom + csvContent;

    let filename = `relatorio-tempo-${dayjs().format('YYYY-MM-DD')}.csv`;
    if (resolvedStartDate && resolvedEndDate) {
      const sStr = String(resolvedStartDate).slice(0, 10);
      const eStr = String(resolvedEndDate).slice(0, 10);
      filename = `relatorio-tempo-${sStr}-a-${eStr}.csv`;
    }

    return {
      csv: fullCsv,
      filename,
      totalEntries: items.length,
      totalSeconds: totalDurationSeconds,
      billableSeconds,
      entries: formattedEntries,
      period: {
        startDate: resolvedStartDate ? String(resolvedStartDate).slice(0, 10) : null,
        endDate: resolvedEndDate ? String(resolvedEndDate).slice(0, 10) : null,
      },
    };
  }
}
