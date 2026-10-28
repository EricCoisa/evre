import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import type { Company } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

@Injectable()
export class FindOneCompanyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly resourceAccess: ResourceAccessService,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<Company> {
    const found = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!found) {
      throw new NotFoundException(this.i18n.t('company.not_found'));
    }

    await this.resourceAccess.assertCanRead(user, { companyId: found.id });

    return found;
  }
}
