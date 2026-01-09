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
import { ActivityStatusConst } from 'src/domain/project/activityStatus.const';

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

    // Registra no histórico do projeto
    await this.prisma.projectHistory.create({
      data: {
        projectId: stage.projectId,
        type: 'ACTIVITY_CREATED',
        payload: JSON.stringify({
          activityId: activity.id,
          stageId: activity.stageId,
          title: activity.title,
          performedById,
        }),
      },
    });

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
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      });
      return activities.map((activity) => this.mapToDto(activity));
    }

    const skip = (page - 1) * limit;
    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
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

    // Registra no histórico do projeto
    const stage = await this.prisma.stage.findUnique({
      where: { id: activity.stageId },
    });

    if (stage) {
      // Se order foi alterado, registra como reorder
      if (
        updateActivityDto.order !== undefined &&
        updateActivityDto.order !== existing.order
      ) {
        await this.prisma.projectHistory.create({
          data: {
            projectId: stage.projectId,
            type: 'ACTIVITY_UPDATED',
            payload: JSON.stringify({
              activityId: activity.id,
              title: activity.title,
              oldOrder: existing.order,
              newOrder: activity.order,
              performedById,
            }),
          },
        });
      } else {
        // Registro normal de atualização
        await this.prisma.projectHistory.create({
          data: {
            projectId: stage.projectId,
            type: 'ACTIVITY_UPDATED',
            payload: JSON.stringify({
              activityId: activity.id,
              title: activity.title,
              changes: updateActivityDto,
              performedById,
            }),
          },
        });
      }
    }

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

    // Registra no histórico do projeto
    const stage = await this.prisma.stage.findUnique({
      where: { id: existing.stageId },
    });

    if (stage) {
      await this.prisma.projectHistory.create({
        data: {
          projectId: stage.projectId,
          type: 'ACTIVITY_DELETED',
          payload: JSON.stringify({
            activityId: existing.id,
            title: existing.title,
            performedById,
          }),
        },
      });
    }

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

  async move(
    activityId: string,
    targetStageId: string,
    performedById: string,
  ): Promise<{ status: boolean; message: string }> {
    // Valida que activity existe
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { stage: true },
    });

    if (!activity) {
      throw new NotFoundException(
        this.i18n.t('activity.errors.not_found') || 'Activity not found',
      );
    }

    // Valida que target stage existe
    const targetStage = await this.prisma.stage.findUnique({
      where: { id: targetStageId },
    });

    if (!targetStage) {
      throw new NotFoundException(
        this.i18n.t('activity.errors.target_stage_not_found') ||
          'Target stage not found',
      );
    }

    // Valida que ambas stages pertencem ao mesmo projeto
    if (activity.stage.projectId !== targetStage.projectId) {
      throw new NotFoundException(
        'Activity and target stage must belong to the same project',
      );
    }

    const oldStageId = activity.stageId;
    const oldStageName = activity.stage.name;

    // Move a activity
    await this.prisma.activity.update({
      where: { id: activityId },
      data: { stageId: targetStageId },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'ACTIVITY',
        action: LogActions.UPDATE,
        message: `Activity ${activity.title} moved`,
        metadata: {
          activityId: activity.id,
          fromStageId: oldStageId,
          toStageId: targetStageId,
        },
      },
      performedById,
    );

    // Registra no histórico do projeto
    await this.prisma.projectHistory.create({
      data: {
        projectId: activity.stage.projectId,
        type: 'ACTIVITY_MOVED',
        payload: JSON.stringify({
          activityId: activity.id,
          title: activity.title,
          fromStageId: oldStageId,
          fromStageName: oldStageName,
          toStageId: targetStageId,
          toStageName: targetStage.name,
          performedById,
        }),
      },
    });

    return {
      status: true,
      message: `Activity moved from "${oldStageName}" to "${targetStage.name}"`,
    };
  }

  async reorder(
    activities: Array<{ activityId: string; order: number }>,
    performedById: string,
  ): Promise<{ status: boolean; message: string }> {
    // Valida que todas as activities existem
    const activityIds = activities.map((a) => a.activityId);
    const existingActivities = await this.prisma.activity.findMany({
      where: { id: { in: activityIds } },
      include: { stage: true },
    });

    if (existingActivities.length !== activityIds.length) {
      throw new NotFoundException(
        this.i18n.t('activity.errors.activity_not_found') ||
          'One or more activities not found',
      );
    }

    // Valida que todas as activities pertencem ao mesmo stage
    const stageIds = new Set(existingActivities.map((a) => a.stageId));
    if (stageIds.size > 1) {
      throw new NotFoundException(
        'All activities must belong to the same stage for reordering',
      );
    }

    // Atualiza a ordem de cada activity
    await this.prisma.$transaction(
      activities.map((item) =>
        this.prisma.activity.update({
          where: { id: item.activityId },
          data: { order: item.order },
        }),
      ),
    );

    const projectId = existingActivities[0].stage.projectId;

    // Log da ação
    await this.loggingService.create(
      {
        module: 'ACTIVITY',
        action: LogActions.UPDATE,
        message: `Activities reordered`,
        metadata: {
          activityCount: activities.length,
          stageId: existingActivities[0].stageId,
        },
      },
      performedById,
    );

    // Registra no histórico do projeto
    await this.prisma.projectHistory.create({
      data: {
        projectId,
        type: 'ACTIVITY_UPDATED',
        payload: JSON.stringify({
          action: 'reordered',
          activityCount: activities.length,
          stageId: existingActivities[0].stageId,
          performedById,
        }),
      },
    });

    return {
      status: true,
      message: `${activities.length} activities reordered successfully`,
    };
  }

  getStatusList(): string[] {
    return Object.values(ActivityStatusConst);
  }
}
