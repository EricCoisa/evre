import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { RespondApprovalDto } from '../dto/respond-approval.dto';

@Injectable()
export class RespondApprovalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly resourceAccess: ResourceAccessService,
  ) {}

  async execute(
    projectId: string,
    approvalId: string,
    dto: RespondApprovalDto,
    user: AuthenticatedUser,
  ) {
    const approval = await this.prisma.milestoneApproval.findUnique({
      where: { id: approvalId },
      include: { milestone: { select: { projectId: true } } },
    });
    if (!approval || approval.milestone.projectId !== projectId) {
      throw new NotFoundException(
        this.i18n.t('project.approval_not_found'),
      );
    }
    if (approval.status !== 'PENDING') {
      throw new BadRequestException(
        this.i18n.t('project.approval_already_responded'),
      );
    }

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { companyId: true },
    });
    await this.resourceAccess.assertCanRead(user, {
      companyId: project.companyId,
      projectId,
    });

    return this.prisma.milestoneApproval.update({
      where: { id: approvalId },
      data: {
        status: dto.status,
        respondedById: user.id,
        responseNote: dto.responseNote,
        respondedAt: new Date(),
      },
    });
  }
}
