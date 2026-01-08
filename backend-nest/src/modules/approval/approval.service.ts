import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { ApprovalDto } from './dto/approval.dto';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/common/types/logging.types';
import { ApprovalEntityType } from '@prisma/client';

@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async create(
    createApprovalDto: CreateApprovalDto,
    userId: string,
  ): Promise<ApprovalDto> {
    // Valida se o projeto existe
    const project = await this.prisma.project.findUnique({
      where: { id: createApprovalDto.projectId },
    });
    if (!project)
      throw new NotFoundException(
        this.i18n.t('approval.errors.project_not_found') || 'Project not found',
      );

    // Valida se a entidade existe baseado no tipo
    let stageName: string | undefined;
    if (createApprovalDto.entityType === 'STAGE') {
      const stage = await this.prisma.stage.findUnique({
        where: { id: createApprovalDto.entityId },
      });
      if (!stage)
        throw new NotFoundException(
          this.i18n.t('approval.errors.stage_not_found') || 'Stage not found',
        );
      // Valida que a stage pertence ao projeto informado
      if (stage.projectId !== createApprovalDto.projectId) {
        throw new NotFoundException(
          this.i18n.t('approval.errors.project_mismatch') || 'Project mismatch',
        );
      }
      stageName = stage.name;
    }

    const approval = await this.prisma.approval.create({
      data: {
        projectId: createApprovalDto.projectId,
        entityType: createApprovalDto.entityType,
        entityId: createApprovalDto.entityId,
        userId,
        status: createApprovalDto.status,
        comment: createApprovalDto.comment || null,
      },
    });

    // Registra histórico no projeto
    await this.prisma.projectHistory.create({
      data: {
        projectId: createApprovalDto.projectId,
        type: 'APPROVAL',
        payload: JSON.stringify({
          approvalId: approval.id,
          entityType: approval.entityType,
          entityId: approval.entityId,
          stageName,
          userId,
          status: approval.status,
          comment: approval.comment,
        }),
      },
    });

    await this.loggingService.create(
      {
        module: 'APPROVAL',
        action: LogActions.CREATE,
        message: `${createApprovalDto.entityType} ${approval.status.toLowerCase()}`,
        metadata: {
          approvalId: approval.id,
          projectId: createApprovalDto.projectId,
          entityType: createApprovalDto.entityType,
          entityId: createApprovalDto.entityId,
        },
      },
      userId,
    );

    return new ApprovalDto(approval);
  }

  async findByEntity(
    entityType: string,
    entityId: string,
  ): Promise<ApprovalDto[]> {
    const approvals = await this.prisma.approval.findMany({
      where: {
        entityType: entityType as ApprovalEntityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
    });
    return approvals.map((a) => new ApprovalDto(a));
  }
}
