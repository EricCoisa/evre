import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { ApprovalDto } from './dto/approval.dto';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/common/types/logging.types';
import { ApprovalEntityType } from '@prisma/client';
import { ApprovalStatusConst } from 'src/domain/project/approvalStatus.const';

@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  /**
   * 🔒 REGRA DE DOMÍNIO: Apenas usuários CLIENTE podem criar Approval
   * 🔒 REGRA DE DOMÍNIO: Approval só pode ser criado se ApprovalRequest existir e estiver PENDING
   * 🔒 REGRA DE DOMÍNIO: Comentário obrigatório para REJECTED e APPROVED_WITH_REMARKS
   * 🔒 REGRA DE DOMÍNIO: Approval é imutável (não pode ser editado)
   */
  async create(
    createApprovalDto: CreateApprovalDto,
    userId: string,
    user?: { role: string; companyId?: string | null },
  ): Promise<ApprovalDto> {
    // 🔒 SECURITY: Apenas CLIENTE pode criar Approval
    if (user && user.role !== 'USER') {
      throw new ForbiddenException(
        this.i18n.t('approval.errors.only_client_can_approve') ||
          'Only clients can create approvals',
      );
    }

    // Busca e valida ApprovalRequest
    const approvalRequest = await this.prisma.approvalRequest.findUnique({
      where: { id: createApprovalDto.approvalRequestId },
      include: {
        project: true,
        stage: true,
      },
    });

    if (!approvalRequest) {
      throw new NotFoundException(
        this.i18n.t('approval.errors.approval_request_not_found') ||
          'Approval request not found',
      );
    }

    // Valida que o request está PENDING
    if (approvalRequest.status !== 'PENDING') {
      throw new BadRequestException(
        this.i18n.t('approval.errors.request_not_pending') ||
          'Approval request is not pending',
      );
    }

    // 🔒 SECURITY: Cliente só pode aprovar projetos da própria empresa
    if (
      user &&
      user.companyId &&
      approvalRequest.project.companyId !== user.companyId
    ) {
      throw new ForbiddenException(
        this.i18n.t('approval.errors.not_your_company') ||
          'You can only approve projects from your company',
      );
    }

    // Valida comentário obrigatório para REJECTED e APPROVED_WITH_REMARKS
    if (
      (createApprovalDto.status === ApprovalStatusConst.REJECTED ||
        createApprovalDto.status ===
          ApprovalStatusConst.APPROVED_WITH_REMARKS) &&
      !createApprovalDto.comment?.trim()
    ) {
      throw new BadRequestException(
        this.i18n.t('approval.errors.comment_required') ||
          'Comment is required for rejection or approval with remarks',
      );
    }

    // Verifica se já existe uma aprovação para este request
    const existingApproval = await this.prisma.approval.findFirst({
      where: { approvalRequestId: createApprovalDto.approvalRequestId },
    });

    if (existingApproval) {
      throw new BadRequestException(
        this.i18n.t('approval.errors.already_answered') ||
          'This approval request has already been answered',
      );
    }

    // Cria a Approval
    const approval = await this.prisma.approval.create({
      data: {
        approvalRequestId: createApprovalDto.approvalRequestId,
        projectId: approvalRequest.projectId,
        entityType: 'STAGE',
        entityId: approvalRequest.stageId,
        userId,
        status: createApprovalDto.status,
        comment: createApprovalDto.comment?.trim() || null,
      },
    });

    // Atualiza status do ApprovalRequest para ANSWERED
    await this.prisma.approvalRequest.update({
      where: { id: createApprovalDto.approvalRequestId },
      data: { status: 'ANSWERED' },
    });

    // Determinar o tipo de histórico baseado no status
    let historyType: string;
    switch (approval.status) {
      case ApprovalStatusConst.APPROVED:
        historyType = 'APPROVAL_APPROVED';
        break;
      case ApprovalStatusConst.APPROVED_WITH_REMARKS:
        historyType = 'APPROVAL_APPROVED_WITH_REMARKS';
        break;
      case ApprovalStatusConst.REJECTED:
        historyType = 'APPROVAL_REJECTED';
        break;
      default:
        historyType = 'APPROVAL';
    }

    // Registra histórico no projeto com evento específico
    await this.prisma.projectHistory.create({
      data: {
        projectId: approvalRequest.projectId,
        type: historyType as any,
        payload: JSON.stringify({
          approvalId: approval.id,
          approvalRequestId: approval.approvalRequestId,
          entityType: approval.entityType,
          entityId: approval.entityId,
          stageId: approvalRequest.stageId,
          stageName: approvalRequest.stage.name,
          userId,
          status: approval.status,
          comment: approval.comment,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    await this.loggingService.create(
      {
        module: 'APPROVAL',
        action: LogActions.CREATE,
        message: `Stage ${approval.status.toLowerCase()} by client`,
        metadata: {
          approvalId: approval.id,
          approvalRequestId: approval.approvalRequestId,
          projectId: approvalRequest.projectId,
          stageId: approvalRequest.stageId,
        },
      },
      userId,
    );

    return new ApprovalDto(approval);
  }

  /**
   * Busca aprovações por entidade (mantido para compatibilidade)
   */
  async findByEntity(
    entityType: string,
    entityId: string,
    user?: { role: string; companyId?: string | null },
  ): Promise<ApprovalDto[]> {
    // 🔒 SECURITY: USER só pode acessar aprovações de projetos da própria empresa
    let projectId: string | null = null;

    if (entityType === 'STAGE') {
      const stage = await this.prisma.stage.findUnique({
        where: { id: entityId },
        select: { projectId: true },
      });
      projectId = stage?.projectId || null;
    }

    // Valida acesso do USER à empresa do projeto
    if (user && user.role === 'USER' && user.companyId && projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { companyId: true },
      });
      if (!project || project.companyId !== user.companyId) {
        throw new NotFoundException('Entity not found');
      }
    }

    const approvals = await this.prisma.approval.findMany({
      where: {
        entityType: entityType as ApprovalEntityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
    });
    return approvals.map((a) => new ApprovalDto(a));
  }

  /**
   * Busca aprovação por ApprovalRequest (novo método)
   */
  async findByApprovalRequest(
    approvalRequestId: string,
    user?: { role: string; companyId?: string | null },
  ): Promise<ApprovalDto | null> {
    const approval = await this.prisma.approval.findUnique({
      where: { approvalRequestId },
      include: {
        approvalRequest: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!approval) {
      return null;
    }

    // 🔒 SECURITY: USER só pode acessar aprovações de projetos da própria empresa
    if (user && user.role === 'USER' && user.companyId) {
      if (approval.approvalRequest.project.companyId !== user.companyId) {
        throw new ForbiddenException('Access denied');
      }
    }

    return new ApprovalDto(approval);
  }
}
