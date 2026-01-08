import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { StageDto } from './dto/stage.dto';
import type { Stage } from '@prisma/client';
import { IBaseService } from 'src/domain/interface/base-service.interface';
import {
  PaginatedResponse,
  PaginationParams,
} from 'src/common/types/pagination.types';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/common/types/logging.types';

@Injectable()
export class StageService implements IBaseService<
  StageDto,
  CreateStageDto,
  UpdateStageDto,
  string
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async create(
    createStageDto: CreateStageDto,
    performedById: string,
  ): Promise<StageDto> {
    // Verifica se o project existe
    const project = await this.prisma.project.findUnique({
      where: { id: createStageDto.projectId },
    });

    if (!project) {
      throw new NotFoundException(
        this.i18n.t('stage.errors.project_not_found') || 'Project not found',
      );
    }

    const stage = await this.prisma.stage.create({
      data: {
        projectId: createStageDto.projectId,
        name: createStageDto.name,
        order: createStageDto.order,
        status: createStageDto.status || '',
      },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'STAGE',
        action: LogActions.CREATE,
        message: `Stage ${stage.name} created`,
        metadata: {
          stageId: stage.id,
          projectId: stage.projectId,
          name: stage.name,
        },
      },
      performedById,
    );

    return this.mapToDto(stage);
  }

  async findAll(
    params?: PaginationParams,
  ): Promise<PaginatedResponse<StageDto> | StageDto[]> {
    const { page, limit, pagination, search, filter } = params || {
      page: 1,
      limit: 10,
      pagination: true,
    };

    const where: {
      name?: { contains: string; mode: 'insensitive' };
      projectId?: string;
    } = {};

    // Busca por texto (name)
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    // Filtro por projectId
    if (filter?.projectId) {
      where.projectId = filter.projectId;
    }

    if (!pagination) {
      const stages = await this.prisma.stage.findMany({
        where,
        orderBy: { order: 'asc' },
      });
      return stages.map((stage) => this.mapToDto(stage));
    }

    const skip = (page - 1) * limit;
    const [stages, total] = await Promise.all([
      this.prisma.stage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { order: 'asc' },
      }),
      this.prisma.stage.count({ where }),
    ]);

    return {
      data: stages.map((stage) => this.mapToDto(stage)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<StageDto> {
    const stage = await this.prisma.stage.findUnique({
      where: { id },
    });

    if (!stage) {
      throw new NotFoundException(
        this.i18n.t('stage.errors.not_found') || 'Stage not found',
      );
    }

    return this.mapToDto(stage);
  }

  async update(
    id: string,
    updateStageDto: UpdateStageDto,
    performedById: string,
  ): Promise<StageDto> {
    const existing = await this.prisma.stage.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(
        this.i18n.t('stage.errors.not_found') || 'Stage not found',
      );
    }

    const stage = await this.prisma.stage.update({
      where: { id },
      data: updateStageDto,
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'STAGE',
        action: LogActions.UPDATE,
        message: `Stage ${stage.name} updated`,
        metadata: {
          stageId: stage.id,
          changes: updateStageDto,
        },
      },
      performedById,
    );

    return this.mapToDto(stage);
  }

  async remove(
    performedById: string,
    id: string,
  ): Promise<{ status: boolean; message: string }> {
    const existing = await this.prisma.stage.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(
        this.i18n.t('stage.errors.not_found') || 'Stage not found',
      );
    }

    await this.prisma.stage.delete({
      where: { id },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'STAGE',
        action: LogActions.DELETE,
        message: `Stage ${existing.name} deleted`,
        metadata: {
          stageId: existing.id,
          name: existing.name,
        },
      },
      performedById,
    );

    return {
      status: true,
      message:
        this.i18n.t('stage.success.deleted') || 'Stage deleted successfully',
    };
  }

  private mapToDto(stage: Stage): StageDto {
    return new StageDto(stage);
  }
}
