import { Injectable, NotFoundException } from '@nestjs/common';
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
import { IsActiveStatusConst } from 'src/domain/approval-request/isActiveStatus.const';

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
    const { page, limit, pagination, search, filter } = query;

    // Constrói a cláusula where separando search e filter
    const where: {
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' };
        description?: { contains: string; mode: 'insensitive' };
      }>;
      isActive?: boolean;
    } = {};

    // Aplica filtro de busca global (search)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Aplica filtros específicos (filter)
    if (filter?.isActive !== undefined) {
      where.isActive = String(filter.isActive) === 'true';
    }

    if (!pagination) {
      const data = await this.prisma.approvalRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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
      }),
      this.prisma.approvalRequest.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const isActiveStatusSet = Object.values(IsActiveStatusConst);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
      filter: {
        isActive: Array.from(isActiveStatusSet),
      },
    };
  }

  async findOne(id: string): Promise<ApprovalRequest | null> {
    const approvalRequest = await this.prisma.approvalRequest.findUnique({
      where: { id },
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

  async create(dto: CreateApprovalRequestDto, performedById: string): Promise<ApprovalRequest> {
    const approvalRequest = await this.prisma.approvalRequest.create({
      data: {
        ...dto,
      },
    });

    await this.loggingService.create(
      {
        module: 'APPROVAL_REQUEST',
        action: LogActions.CREATE,
        message: `ApprovalRequest created: ${dto.name}`,
        metadata: { approvalRequestId: approvalRequest.id },
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
    await this.findOne(id);

    const approvalRequest = await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        ...dto,
      },
    });

    await this.loggingService.create(
      {
        module: 'APPROVAL_REQUEST',
        action: LogActions.UPDATE,
        message: `ApprovalRequest updated: approvalRequest`,
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
    await this.findOne(id);

    await this.prisma.approvalRequest.delete({
      where: { id },
    });

    await this.loggingService.create(
      {
        module: 'APPROVAL_REQUEST',
        action: LogActions.DELETE,
        message: `ApprovalRequest deleted: approvalRequest`,
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
