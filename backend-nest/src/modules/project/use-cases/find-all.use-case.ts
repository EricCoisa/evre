import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginationQuery } from '../../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../../common/types/pagination.types';
import { paginate } from '../../../common/utils/paginate.util';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { Project } from '@prisma/client';

@Injectable()
export class FindAllProjectUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resourceAccess: ResourceAccessService,
  ) {}

  async execute(
    query: PaginationQuery,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<Project> | Project[]> {
    const { search, filter } = query;

    const and: Prisma.ProjectWhereInput[] = [];
    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { company: { name: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }
    if (filter?.companyId) {
      and.push({ companyId: filter.companyId });
    }

    const scope = await this.resourceAccess.scopeFilter(user);
    if (scope) {
      const companyIds = scope.OR.filter(
        (clause): clause is { companyId: { in: string[] } } =>
          'companyId' in clause,
      ).flatMap((clause) => clause.companyId.in);
      const projectIds = scope.OR.filter(
        (clause): clause is { projectId: { in: string[] } } =>
          'projectId' in clause,
      ).flatMap((clause) => clause.projectId.in);
      and.push({
        OR: [{ companyId: { in: companyIds } }, { id: { in: projectIds } }],
      });
    }

    const where: Prisma.ProjectWhereInput = {
      archivedAt: null,
      ...(and.length ? { AND: and } : {}),
    };

    return paginate(query, {
      findMany: (p) =>
        this.prisma.project.findMany({
          where,
          include: { company: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          ...p,
        }),
      count: () => this.prisma.project.count({ where }),
    });
  }
}
