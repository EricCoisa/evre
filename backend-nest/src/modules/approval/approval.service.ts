import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { ApprovalDto } from './dto/approval.dto';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/common/types/logging.types';

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
    const stage = await this.prisma.stage.findUnique({
      where: { id: createApprovalDto.stageId },
      include: { project: true },
    });
    if (!stage)
      throw new NotFoundException(
        this.i18n.t('approval.errors.stage_not_found') || 'Stage not found',
      );

    const approval = await this.prisma.approval.create({
      data: {
        stageId: createApprovalDto.stageId,
        userId,
        status: createApprovalDto.status,
        comment: createApprovalDto.comment || null,
      },
    });

    // Registra histórico no projeto
    await this.prisma.projectHistory.create({
      data: {
        projectId: stage.projectId,
        type: 'APPROVAL',
        payload: JSON.stringify({
          approvalId: approval.id,
          stageId: stage.id,
          stageName: stage.name,
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
        message: `Stage ${stage.name} ${approval.status.toLowerCase()}`,
        metadata: { approvalId: approval.id },
      },
      userId,
    );

    return new ApprovalDto(approval);
  }

  async findByStage(stageId: string): Promise<ApprovalDto[]> {
    const approvals = await this.prisma.approval.findMany({
      where: { stageId },
      orderBy: { createdAt: 'desc' },
    });
    return approvals.map((a) => new ApprovalDto(a));
  }
}
