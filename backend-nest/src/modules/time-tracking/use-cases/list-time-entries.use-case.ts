import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import {
  TIME_TRACKING_CONFIG_KEYS,
  TIME_TRACKING_DEFAULT_FORGOTTEN_THRESHOLD_HOURS,
} from 'src/domain/time-tracking/time-tracking.const';
import type { ListTimeEntriesDto } from '../dto/list-time-entries.dto';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

@Injectable()
export class ListTimeEntriesUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigurationService,
  ) {}

  async execute(dto: ListTimeEntriesDto, user: AuthenticatedUser) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TimeEntryWhereInput = {};

    // Restrição de role: se for MODERATOR, lista apenas as suas horas a menos que seja ADMIN
    if (user.roleName !== 'ADMIN') {
      where.userId = user.id;
    } else if (dto.userId) {
      where.userId = dto.userId;
    }

    if (dto.projectId) {
      where.projectId = dto.projectId;
    }

    if (dto.entityType) {
      where.entityType = dto.entityType;
    }

    if (dto.entityId) {
      where.entityId = dto.entityId;
    }

    if (dto.search) {
      where.OR = [
        { description: { contains: dto.search, mode: 'insensitive' } },
        { entityTitle: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    if (dto.startDate || dto.endDate) {
      where.startTime = {};
      if (dto.startDate) {
        where.startTime.gte = new Date(dto.startDate);
      }
      if (dto.endDate) {
        where.startTime.lte = new Date(dto.endDate);
      }
    }

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

    const [items, total] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startTime: 'desc' },
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
      }),
      this.prisma.timeEntry.count({ where }),
    ]);

    const enrichedItems = items.map((item) => {
      let isForgotten = false;
      if (!item.endTime) {
        const elapsedMs = Date.now() - new Date(item.startTime).getTime();
        isForgotten = elapsedMs >= thresholdHours * 3600 * 1000;
      }
      return {
        ...item,
        isForgotten,
      };
    });

    return {
      data: enrichedItems,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
