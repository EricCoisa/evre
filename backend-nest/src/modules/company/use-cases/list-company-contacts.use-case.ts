import { Injectable } from '@nestjs/common';
import type { Contact } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

/** Lista os contatos ativos de uma empresa; nega antes de consultar quem não tem Membership nela. */
@Injectable()
export class ListCompanyContactsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resourceAccess: ResourceAccessService,
  ) {}

  async execute(
    companyId: string,
    user: AuthenticatedUser,
  ): Promise<Contact[]> {
    await this.resourceAccess.assertCanRead(user, { companyId });

    return this.prisma.contact.findMany({
      where: { companyId, archivedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }
}
