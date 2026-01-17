import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { StageDto } from './dto/stage.dto';
import type { Stage, StageStatus } from '@prisma/client';
import { IBaseService } from 'src/domain/interface/base-service.interface';
import {
  PaginatedResponse,
  PaginationParams,
} from 'src/common/types/pagination.types';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/common/types/logging.types';
import { StageStatusConst } from 'src/domain/project/stageStatus.const';

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

    // Calcula o próximo order (ignora o valor enviado)
    const lastStage = await this.prisma.stage.findFirst({
      where: { projectId: createStageDto.projectId },
      orderBy: { order: 'desc' },
    });
    const nextOrder = lastStage ? lastStage.order + 1 : 1;

    const stage = await this.prisma.stage.create({
      data: {
        projectId: createStageDto.projectId,
        name: createStageDto.name,
        order: nextOrder,
        status: createStageDto.status || 'TODO',
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

    // Registra no histórico do projeto
    await this.prisma.projectHistory.create({
      data: {
        projectId: stage.projectId,
        type: 'STAGE_CREATED',
        payload: JSON.stringify({
          stageId: stage.id,
          name: stage.name,
          order: stage.order,
          performedById,
        }),
      },
    });

    return this.mapToDto(stage);
  }

  /**
   * 🔒 SECURITY: Lista stages por project com validação completa de hierarquia
   * Valida: project existe → user tem acesso à company
   */
  async findAllByProject(
    projectId: string,
    params?: PaginationParams,
    user?: { role: string; companyId?: string | null },
  ): Promise<PaginatedResponse<StageDto> | StageDto[]> {
    // 1. Busca o project e valida hierarquia project → company
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, companyId: true },
    });

    if (!project) {
      throw new NotFoundException(
        this.i18n.t('stage.errors.project_not_found') || 'Project not found',
      );
    }

    // 2. 🔒 SECURITY: USER só pode acessar projects da própria empresa
    if (user && user.role === 'USER' && user.companyId) {
      if (project.companyId !== user.companyId) {
        throw new NotFoundException(
          this.i18n.t('stage.errors.project_not_found') || 'Project not found',
        );
      }
    }

    // 3. Busca stages do project
    const { page, limit, pagination, search } = params || {
      page: 1,
      limit: 10,
      pagination: true,
    };

    const where: {
      projectId: string;
      name?: { contains: string; mode: 'insensitive' };
    } = {
      projectId, // SEMPRE filtra por projectId
    };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
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

  /**
   * @deprecated Use findAllByProject instead
   */
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

  async findOne(
    id: string,
    user?: { role: string; companyId?: string | null },
  ): Promise<StageDto> {
    const stage = await this.prisma.stage.findUnique({
      where: { id },
      include: { project: { select: { companyId: true } } },
    });

    if (!stage) {
      throw new NotFoundException(
        this.i18n.t('stage.errors.not_found') || 'Stage not found',
      );
    }

    // 🔒 SECURITY: USER só pode acessar stages de projetos da própria empresa
    if (user && user.role === 'USER' && user.companyId) {
      if (stage.project.companyId !== user.companyId) {
        throw new NotFoundException(
          this.i18n.t('stage.errors.not_found') || 'Stage not found',
        );
      }
    }

    return this.mapToDto(stage as Stage);
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

    // Registra no histórico do projeto
    await this.prisma.projectHistory.create({
      data: {
        projectId: stage.projectId,
        type: 'STAGE_UPDATED',
        payload: JSON.stringify({
          stageId: stage.id,
          name: stage.name,
          changes: updateStageDto,
          performedById,
        }),
      },
    });

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

    // Reorganiza order das stages restantes no mesmo projeto
    const remainingStages = await this.prisma.stage.findMany({
      where: { projectId: existing.projectId },
      orderBy: { order: 'asc' },
    });

    for (let i = 0; i < remainingStages.length; i++) {
      await this.prisma.stage.update({
        where: { id: remainingStages[i].id },
        data: { order: i + 1 },
      });
    }

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

    // Registra no histórico do projeto
    await this.prisma.projectHistory.create({
      data: {
        projectId: existing.projectId,
        type: 'STAGE_DELETED',
        payload: JSON.stringify({
          stageId: existing.id,
          name: existing.name,
          performedById,
        }),
      },
    });

    return {
      status: true,
      message:
        this.i18n.t('stage.success.deleted') || 'Stage deleted successfully',
    };
  }

  private mapToDto(stage: Stage): StageDto {
    return new StageDto(stage);
  }

  /**
   * Updates only the status of a stage - MANUAL operation only
   * Stage.status is NEVER automatically derived from activities
   */
  async updateStatus(
    id: string,
    status: StageStatus,
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

    const oldStatus = existing.status;

    const stage = await this.prisma.stage.update({
      where: { id },
      data: { status },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'STAGE',
        action: LogActions.UPDATE,
        message: `Stage ${stage.name} status changed from ${oldStatus} to ${status}`,
        metadata: {
          stageId: stage.id,
          from: oldStatus,
          to: status,
        },
      },
      performedById,
    );

    // Registra no histórico do projeto
    await this.prisma.projectHistory.create({
      data: {
        projectId: stage.projectId,
        type: 'STAGE_UPDATED',
        payload: JSON.stringify({
          stageId: stage.id,
          name: stage.name,
          changes: { status: { from: oldStatus, to: status } },
          performedById,
        }),
      },
    });

    return this.mapToDto(stage);
  }

  async reorder(
    stages: Array<{ stageId: string; order: number }>,
    performedById: string,
  ): Promise<{ status: boolean; message: string }> {
    if (stages.length === 0) {
      throw new NotFoundException('No stages provided');
    }

    // Valida que todas as stages existem e pertencem ao mesmo projeto
    const stageIds = stages.map((s) => s.stageId);
    const existingStages = await this.prisma.stage.findMany({
      where: { id: { in: stageIds } },
    });

    if (existingStages.length !== stages.length) {
      throw new NotFoundException('One or more stages not found');
    }

    const projectIds = [...new Set(existingStages.map((s) => s.projectId))];
    if (projectIds.length !== 1) {
      throw new NotFoundException('All stages must belong to the same project');
    }

    // Atualiza order de cada stage
    for (const stageData of stages) {
      await this.prisma.stage.update({
        where: { id: stageData.stageId },
        data: { order: stageData.order },
      });
    }

    // Log da ação
    await this.loggingService.create(
      {
        module: 'STAGE',
        action: LogActions.UPDATE,
        message: 'Stages reordered',
        metadata: {
          projectId: projectIds[0],
          stages: stages,
        },
      },
      performedById,
    );

    // Registra no histórico do projeto
    await this.prisma.projectHistory.create({
      data: {
        projectId: projectIds[0],
        type: 'STAGE_REORDERED',
        payload: JSON.stringify({
          stages: stages.map((s) => ({ stageId: s.stageId, order: s.order })),
          performedById,
        }),
      },
    });

    return {
      status: true,
      message: 'Stages reordered successfully',
    };
  }

  /**
   * 📊 HELPER: Obtém estado de aprovação derivado de um Stage
   * ⚠️ Não armazena no Stage - apenas consulta o último ApprovalRequest + Approval
   */
  async getApprovalState(stageId: string): Promise<{
    hasPendingApproval: boolean;
    lastApprovalStatus: string | null;
    lastApprovalAt: Date | null;
    lastApprovalComment: string | null;
    lastApprovalRequestId: string | null;
    canRequestNewApproval: boolean;
  }> {
    // Buscar o último ApprovalRequest do stage
    const lastRequest = await this.prisma.approvalRequest.findFirst({
      where: { stageId },
      orderBy: { createdAt: 'desc' },
      include: {
        approval: true,
      },
    });

    if (!lastRequest) {
      return {
        hasPendingApproval: false,
        lastApprovalStatus: null,
        lastApprovalAt: null,
        lastApprovalComment: null,
        lastApprovalRequestId: null,
        canRequestNewApproval: true,
      };
    }

    const hasPendingApproval = lastRequest.status === 'PENDING';
    const isAnswered = lastRequest.status === 'ANSWERED';
    const lastApproval = lastRequest.approval;

    // Pode solicitar nova aprovação se:
    // - Não tem request pendente
    // - E (não tem nenhuma aprovação OU última foi REJECTED ou APPROVED_WITH_REMARKS)
    const canRequestNewApproval = 
      !hasPendingApproval && 
      (!lastApproval || 
        lastApproval.status === 'REJECTED' || 
        lastApproval.status === 'APPROVED_WITH_REMARKS');

    return {
      hasPendingApproval,
      lastApprovalStatus: lastApproval?.status || null,
      lastApprovalAt: lastApproval?.createdAt || null,
      lastApprovalComment: lastApproval?.comment || null,
      lastApprovalRequestId: lastRequest.id,
      canRequestNewApproval,
    };
  }

  getStatusList(): string[] {
    return Object.values(StageStatusConst);
  }
}
