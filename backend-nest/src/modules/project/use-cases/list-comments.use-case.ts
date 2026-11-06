import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import { ProjectCommentEntityType } from '@prisma/client';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

@Injectable()
export class ListCommentsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly resourceAccess: ResourceAccessService,
  ) {}

  async execute(
    projectId: string,
    entityType: string,
    entityId: string,
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

    return this.prisma.projectComment.findMany({
      where: {
        projectId,
        entityType: entityType as ProjectCommentEntityType,
        entityId,
      },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, imageUrl: true } } },
    });
  }
}
