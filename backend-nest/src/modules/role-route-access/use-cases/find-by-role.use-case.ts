import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginationQuery } from '../../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../../common/types/pagination.types';
import { paginate } from '../../../common/utils/paginate.util';
import { isRoleAllowedForRoute } from '../../../common/utils/route-roles.util';
import { RouteCeilingRegistry } from '../../../common/infrastructure/route-ceiling/route-ceiling.registry';
import type { RoleRouteAccessDto } from '../dto/role-route-access.dto';

@Injectable()
export class FindByRoleUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly routeCeilings: RouteCeilingRegistry,
  ) {}

  async execute(
    roleId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<RoleRouteAccessDto> | RoleRouteAccessDto[]> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(this.i18n.t('role.not_found'));
    }

    const { search } = query;

    const where: Prisma.RouteWhereInput = search
      ? {
          OR: [
            { path: { contains: search } },
            { labelKey: { contains: search } },
          ],
        }
      : {};

    const include = {
      roleRouteAccesses: {
        where: { roleId },
        select: { roleId: true, routeId: true },
      },
    };

    // O teto vem do registro em código (RouteCeilingRegistry), não do banco — filtra aqui,
    // não na query, por isso a paginação abaixo pagina o array já filtrado.
    const candidates = await this.prisma.route.findMany({
      where,
      include,
      orderBy: { path: 'asc' },
    });
    const eligible = candidates.filter((route) =>
      isRoleAllowedForRoute(
        this.routeCeilings.allowedRolesFor(route.path),
        role.name,
      ),
    );

    const map = (route: (typeof eligible)[number]) => ({
      id: route.id,
      path: route.path,
      labelKey: route.labelKey,
      icon: route.icon,
      isActive: route.isActive,
      hasAccess: route.roleRouteAccesses.length > 0,
      roleId,
      routeId: route.id,
      route:
        route.roleRouteAccesses.length > 0
          ? {
              id: route.id,
              path: route.path,
              labelKey: route.labelKey,
              icon: route.icon,
            }
          : undefined,
      createdAt: route.createdAt.toISOString(),
      updatedAt: route.updatedAt.toISOString(),
    });

    return paginate(query, {
      findMany: ({ skip, take }) =>
        Promise.resolve(
          eligible.slice(skip ?? 0, (skip ?? 0) + (take ?? eligible.length)),
        ),
      count: () => Promise.resolve(eligible.length),
      map,
    });
  }
}
