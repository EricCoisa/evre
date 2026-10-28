import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginationQuery } from '../../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../../common/types/pagination.types';
import { paginate } from '../../../common/utils/paginate.util';
import { RoleRouteAccess } from 'src/domain/role-route-access/role-route-access.entity';
import { RouteSelect } from 'src/domain/route/route.select';

@Injectable()
export class FindAllRoleRouteAccessUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<RoleRouteAccess> | RoleRouteAccess[]> {
    const include = { route: { select: RouteSelect } };
    const orderBy = [{ roleId: 'asc' as const }, { routeId: 'asc' as const }];

    return paginate(query, {
      findMany: (p) =>
        this.prisma.roleRouteAccess.findMany({ include, orderBy, ...p }),
      count: () => this.prisma.roleRouteAccess.count(),
    });
  }
}
