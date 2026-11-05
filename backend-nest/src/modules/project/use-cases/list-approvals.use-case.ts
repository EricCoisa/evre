import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

@Injectable()
export class ListApprovalsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly resourceAccess: ResourceAccessService,
  ) {}

  async execute(
    projectId: string,
    milestoneId: string,
    user: AuthenticatedUser,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, companyId: true },
    });
    if (!project) {
      throw new NotFoundException(this.i18n.t('project.not_found'));
    }
    await this.resourceAccess.assertCanRead(user, {
      companyId: project.companyId,
      projectId,
    });

    return this.prisma.milestoneApproval.findMany({
      where: { milestoneId, milestone: { projectId } },
      orderBy: { requestedAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, name: true } },
        respondedBy: { select: { id: true, name: true } },
      },
    });
  }
}
