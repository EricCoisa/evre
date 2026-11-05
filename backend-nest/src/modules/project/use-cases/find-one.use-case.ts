import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

@Injectable()
export class FindOneProjectUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly resourceAccess: ResourceAccessService,
  ) {}

  async execute(id: string, user: AuthenticatedUser) {
    const found = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!found) {
      throw new NotFoundException(this.i18n.t('project.not_found'));
    }

    await this.resourceAccess.assertCanRead(user, {
      companyId: found.companyId,
      projectId: found.id,
    });

    return found;
  }
}
