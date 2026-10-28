import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginationQuery } from '../../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../../common/types/pagination.types';
import { paginate } from '../../../common/utils/paginate.util';
import { Route } from 'src/domain/route/route.entity';

@Injectable()
export class FindAllRoutesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<Route> | Route[]> {
    const { search } = query;

    // É `labelKey`, não `label`: `label` não existe no model.
    const where: Prisma.RouteWhereInput = search
      ? {
          OR: [
            { path: { contains: search } },
            { labelKey: { contains: search } },
          ],
        }
      : {};

    const orderBy: Prisma.RouteOrderByWithRelationInput[] = [
      { ordem: 'asc' },
      { labelKey: 'asc' },
    ];

    return paginate(query, {
      findMany: (p) =>
        this.prisma.route.findMany({
          where,
          orderBy,
          include: { parent: true },
          ...p,
        }),
      count: () => this.prisma.route.count({ where }),
      map: (route) => ({
        ...route,
        parent: route.parent ? { ...route.parent } : null,
        showSidebar: route.showSideBar,
      }),
    });
  }
}
