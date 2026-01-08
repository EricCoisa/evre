import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ActivityDto } from './dto/activity.dto';
import type { Activity } from '@prisma/client';
import { IBaseService } from 'src/domain/interface/base-service.interface';
import {
  PaginatedResponse,
  PaginationParams,
} from 'src/common/types/pagination.types';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/common/types/logging.types';

@Injectable()
export class ActivityService implements IBaseService<
  ActivityDto,
  CreateActivityDto,
  UpdateActivityDto,
  string
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async create(
    createActivityDto: CreateActivityDto,
    performedById: string,
  ): Promise<ActivityDto> {
    const stage = await this.prisma.stage.findUnique({
      where: { id: createActivityDto.stageId },
    });

    if (!stage) {
      throw new NotFoundException(
        this.i18n.t('activity.errors.stage_not_found') || 'Stage not found',
      );
    }

    const activity = await this.prisma.activity.create({
      data: {
        stageId: createActivityDto.stageId,
        title: createActivityDto.title,
        description: createActivityDto.description || null,
        status: createActivityDto.status || 'TODO',
      },
    });

    await this.loggingService.create(
      {
        module: 'ACTIVITY',
        action: LogActions.CREATE,
        message: `Activity ${activity.title} created`,
        metadata: {
          activityId: activity.id,
          stageId: activity.stageId,
          title: activity.title,
        },
      },
      performedById,
    );

    return this.mapToDto(activity);
  }

  async findAll(
    params?: PaginationParams,
  ): Promise<PaginatedResponse<ActivityDto> | ActivityDto[]> {
    const { page, limit, pagination, search, filter } = params || {
      page: 1,
      limit: 10,
      pagination: true,
    };

    const where: {
      OR?: Array<{
        title?: { contains: string; mode: 'insensitive' };
        description?: { contains: string; mode: 'insensitive' };
      }>;
      stageId?: string;
      status?: any;
    } = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filter?.stageId) {
      where.stageId = filter.stageId;
    }

    if (filter?.status) {
      where.status = filter.status;
    }

    if (!pagination) {
      const activities = await this.prisma.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      return activities.map((activity) => this.mapToDto(activity));
    }

    const skip = (page - 1) * limit;
    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      data: activities.map((activity) => this.mapToDto(activity)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<ActivityDto> {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException(
        this.i18n.t('activity.errors.not_found') || 'Activity not found',
      );
    }

    return this.mapToDto(activity);
  }

  async update(
    id: string,
    updateActivityDto: UpdateActivityDto,
    performedById: string,
  ): Promise<ActivityDto> {
    const existing = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(
        this.i18n.t('activity.errors.not_found') || 'Activity not found',
      );
    }

    const activity = await this.prisma.activity.update({
      where: { id },
      data: updateActivityDto,
    });

    await this.loggingService.create(
      {
        module: 'ACTIVITY',
        action: LogActions.UPDATE,
        message: `Activity ${activity.title} updated`,
        metadata: {
          activityId: activity.id,
          changes: updateActivityDto,
        },
      },
      performedById,
    );

    return this.mapToDto(activity);
  }

  async remove(
    performedById: string,
    id: string,
  ): Promise<{ status: boolean; message: string }> {
    const existing = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(
        this.i18n.t('activity.errors.not_found') || 'Activity not found',
      );
    }

    await this.prisma.activity.delete({
      where: { id },
    });

    await this.loggingService.create(
      {
        module: 'ACTIVITY',
        action: LogActions.DELETE,
        message: `Activity ${existing.title} deleted`,
        metadata: {
          activityId: existing.id,
          title: existing.title,
        },
      },
      performedById,
    );

    return {
      status: true,
      message:
        this.i18n.t('activity.success.deleted') ||
        'Activity deleted successfully',
    };
  }

  private mapToDto(activity: Activity): ActivityDto {
    return new ActivityDto(activity);
  }
}
