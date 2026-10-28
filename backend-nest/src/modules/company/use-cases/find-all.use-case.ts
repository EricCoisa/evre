import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginationQuery } from '../../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../../common/types/pagination.types';
import { paginate } from '../../../common/utils/paginate.util';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { Company } from '@prisma/client';

@Injectable()
export class FindAllCompanyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resourceAccess: ResourceAccessService,
  ) {}

  async execute(
    query: PaginationQuery,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<Company> | Company[]> {
    const { search, filter } = query;
    const showArchived =
      filter?.archivedAt !== undefined && String(filter.archivedAt) === 'true';

    const and: Prisma.CompanyWhereInput[] = [];
    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { tradeName: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    // Company é o próprio recurso de escopo: sua PK faz o papel de "companyId" aqui.
    // Membership por projectId não abre a empresa — só companyId concede a linha-pai.
    const scope = await this.resourceAccess.scopeFilter(user);
    if (scope) {
      const companyIds = scope.OR.filter(
        (clause): clause is { companyId: { in: string[] } } =>
          'companyId' in clause,
      ).flatMap((clause) => clause.companyId.in);
      and.push({ id: { in: companyIds } });
    }

    const where: Prisma.CompanyWhereInput = {
      archivedAt: showArchived ? { not: null } : null,
      ...(and.length ? { AND: and } : {}),
    };

    return paginate(query, {
      findMany: (p) =>
        this.prisma.company.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...p,
        }),
      count: () => this.prisma.company.count({ where }),
    });
  }
}
