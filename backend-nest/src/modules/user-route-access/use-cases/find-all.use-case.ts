import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Route } from '@prisma/client';
import type { PaginationQuery } from '../../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../../common/types/pagination.types';
import { paginate } from '../../../common/utils/paginate.util';
import type { UserRouteAccessDto } from '../dto/user-route-access.dto';

@Injectable()
export class FindAllUserRouteAccessUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<UserRouteAccessDto> | UserRouteAccessDto[]> {
    const { search } = query;

    const where = search
      ? {
          OR: [
            { user: { email: { contains: search } } },
            { user: { name: { contains: search } } },
            { route: { labelKey: { contains: search } } },
            { route: { path: { contains: search } } },
          ],
        }
      : {};

    const include = {
      user: { select: { id: true, email: true, name: true } },
      route: { select: { id: true, path: true, labelKey: true } },
      grantedByUser: { select: { id: true, email: true, name: true } },
    };

    return paginate(query, {
      findMany: (p) =>
        this.prisma.userRouteAccess.findMany({
          where,
          include,
          orderBy: { createdAt: 'desc' },
          ...p,
        }),
      count: () => this.prisma.userRouteAccess.count({ where }),
      map: (access) => ({
        ...access,
        route: access.route
          ? {
              id: access.route.id,
              path: access.route.path,
              labelKey: (access.route as Route).labelKey,
            }
          : undefined,
        createdAt: access.createdAt.toISOString(),
      }),
    });
  }
}
