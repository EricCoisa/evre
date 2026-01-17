import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggingService } from '../logging/logging.service';
import { IBaseService } from '../../domain/interface/base-service.interface';
import type { ApprovalRequest } from '../../domain/approval-request/approval-request.entity';
import type { CreateApprovalRequestDto } from './dto/create-approval-request.dto';
import type { UpdateApprovalRequestDto } from './dto/update-approval-request.dto';
import type { PaginationQuery } from '../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import { LogActions } from 'src/common/types/logging.types';
import {
  ApprovalRequestStatus,
  ApprovalRequestStatusEnum,
} from 'src/domain/approval-request/approval-requestStatus.const';

@Injectable()
export class ApprovalRequestService implements IBaseService<
  ApprovalRequest,
  CreateApprovalRequestDto,
  UpdateApprovalRequestDto
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async findAll(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<ApprovalRequest> | ApprovalRequest[]> {
    const { page, limit, pagination, filter } = query;

    const where: {
      status?: ApprovalRequestStatus;
      stageId?: string;
    } = {};

    // Filtro por status
    if (filter?.status) {
      where.status = filter.status as ApprovalRequestStatus;
    }

    // Filtro por stageId
    if (filter?.stageId) {
      where.stageId = filter.stageId;
    }

    if (!pagination) {
      const data = await this.prisma.approvalRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { id: true, name: true } },
          stage: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, name: true, email: true } },
        },
      });
      return data;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.approvalRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { id: true, name: true } },
          stage: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.approvalRequest.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
      filter: {
        status: Object.values(ApprovalRequestStatus),
      },
    };
  }

  async findOne(id: string): Promise<ApprovalRequest> {
    const approvalRequest = await this.prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, companyId: true } },
        stage: { select: { id: true, name: true, projectId: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!approvalRequest) {
      throw new NotFoundException(
        this.i18n.t('approval_request.not_found', {
          lang: 'en',
        }),
      );
    }

    return approvalRequest;
  }

  async create(
    dto: CreateApprovalRequestDto,
    performedById: string,
  ): Promise<ApprovalRequest> {
    // Buscar informações do usuário admin
    const admin = await this.prisma.user.findUnique({
      where: { id: performedById },
      select: { role: true, companyId: true },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException(
        this.i18n.t('approval_request.admin_only', { lang: 'en' }),
      );
    }

    // Validar que o projeto existe
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true, companyId: true },
    });

    if (!project) {
      throw new NotFoundException(
        this.i18n.t('project.not_found', { lang: 'en' }),
      );
    }

    // Validar que o stage existe e pertence ao projeto
    const stage = await this.prisma.stage.findUnique({
      where: { id: dto.stageId },
      select: { id: true, projectId: true, name: true },
    });

    if (!stage) {
      throw new NotFoundException(
        this.i18n.t('stage.not_found', { lang: 'en' }),
      );
    }

    if (stage.projectId !== dto.projectId) {
      throw new BadRequestException(
        this.i18n.t('approval_request.stage_not_in_project', { lang: 'en' }),
      );
    }

    // Validar que não existe um ApprovalRequest PENDING para este stage
    const existingPendingRequest = await this.prisma.approvalRequest.findFirst({
      where: {
        stageId: dto.stageId,
        status: ApprovalRequestStatusEnum.PENDING,
      },
    });

    if (existingPendingRequest) {
      throw new BadRequestException(
        this.i18n.t('approval_request.already_pending', { lang: 'en' }),
      );
    }

    // Criar o ApprovalRequest
    const approvalRequest = await this.prisma.approvalRequest.create({
      data: {
        projectId: dto.projectId,
        stageId: dto.stageId,
        requestedById: performedById,
        status: ApprovalRequestStatusEnum.PENDING,
      },
      include: {
        project: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Registrar no histórico do projeto
    await this.prisma.projectHistory.create({
      data: {
        projectId: dto.projectId,
        type: 'APPROVAL_REQUESTED',
        payload: JSON.stringify({
          stageId: dto.stageId,
          stageName: stage.name,
          requestedById: performedById,
          approvalRequestId: approvalRequest.id,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'APPROVAL_REQUEST',
        action: LogActions.CREATE,
        message: `Approval request created for stage: ${stage.name}`,
        metadata: {
          approvalRequestId: approvalRequest.id,
          projectId: dto.projectId,
          stageId: dto.stageId,
        },
      },
      performedById,
    );

    return approvalRequest;
  }

  async update(
    id: string,
    dto: UpdateApprovalRequestDto,
    performedById: string,
  ): Promise<ApprovalRequest> {
    const existing = await this.findOne(id);

    // Validar se o usuário é admin da mesma company
    const admin = await this.prisma.user.findUnique({
      where: { id: performedById },
      select: { role: true, companyId: true },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException(
        this.i18n.t('approval_request.admin_only', { lang: 'en' }),
      );
    }

    // Buscar o projeto para verificar a company
    const project = await this.prisma.project.findUnique({
      where: { id: existing.projectId },
      select: { companyId: true },
    });

    if (!project) {
      throw new NotFoundException(
        this.i18n.t('project.not_found', { lang: 'en' }),
      );
    }

    const approvalRequest = await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        ...dto,
      },
      include: {
        project: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await this.loggingService.create(
      {
        module: 'APPROVAL_REQUEST',
        action: LogActions.UPDATE,
        message: `Approval request updated`,
        metadata: { approvalRequestId: id },
      },
      performedById,
    );

    return approvalRequest;
  }

  async remove(
    performedById: string,
    id: string,
  ): Promise<{ status: boolean; message: string }> {
    const existing = await this.findOne(id);

    // Validar se o usuário é admin da mesma company
    const admin = await this.prisma.user.findUnique({
      where: { id: performedById },
      select: { role: true, companyId: true },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException(
        this.i18n.t('approval_request.admin_only', { lang: 'en' }),
      );
    }

    // Buscar o projeto para verificar a company
    const project = await this.prisma.project.findUnique({
      where: { id: existing.projectId },
      select: { companyId: true },
    });

    if (!project) {
      throw new NotFoundException(
        this.i18n.t('project.not_found', { lang: 'en' }),
      );
    }

    await this.prisma.approvalRequest.delete({
      where: { id },
    });

    await this.loggingService.create(
      {
        module: 'APPROVAL_REQUEST',
        action: LogActions.DELETE,
        message: `Approval request deleted`,
        metadata: { approvalRequestId: id },
      },
      performedById,
    );

    return {
      status: true,
      message: this.i18n.t('approval_request.deleted_successfully', {
        lang: 'en',
      }),
    };
  }
}
