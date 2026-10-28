import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { Route } from '@prisma/client';
import { RedisService } from '../../../common/infrastructure/redis/redis.service';
import type { PaginationQuery } from '../../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../../common/types/pagination.types';
import { paginate } from '../../../common/utils/paginate.util';
import type { UserRouteAccessDto } from '../dto/user-route-access.dto';

const ROUTES_CACHE_TTL = 300; // 5 minutes

@Injectable()
export class FindAllByOneUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly redis: RedisService,
  ) {}

  async execute(
    userId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<UserRouteAccessDto> | UserRouteAccessDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }

    const include = {
      route: {
        select: { id: true, path: true, labelKey: true, isActive: true },
      },
    };

    // Um `map` só para os dois caminhos.
    const mapAccess = (access: {
      route: { id: string; path: string; isActive: boolean } | null;
      createdAt: Date;
      [k: string]: unknown;
    }) => ({
      ...access,
      route: access.route
        ? {
            id: access.route.id,
            path: access.route.path,
            labelKey: (access.route as Route).labelKey,
            isActive: access.route.isActive,
          }
        : undefined,
      createdAt: access.createdAt.toISOString(),
    });

    // Só esta lista passa pelo cache: middleware de auth.
    if (!query.pagination) {
      const cacheKey = `user:routes:${userId}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached) as UserRouteAccessDto[];
        } catch {
          // entrada corrompida — cai no banco
        }
      }
      const accesses = await this.prisma.userRouteAccess.findMany({
        where: { userId },
        include,
        orderBy: { route: { path: 'asc' } },
      });
      const result = accesses.map(mapAccess) as UserRouteAccessDto[];
      await this.redis.set(cacheKey, JSON.stringify(result), ROUTES_CACHE_TTL);
      return result;
    }

    return paginate(query, {
      findMany: (p) =>
        this.prisma.userRouteAccess.findMany({
          where: { userId },
          include,
          orderBy: { route: { path: 'asc' } },
          ...p,
        }),
      count: () => this.prisma.userRouteAccess.count({ where: { userId } }),
      map: (a) => mapAccess(a) as UserRouteAccessDto,
    });
  }
}
