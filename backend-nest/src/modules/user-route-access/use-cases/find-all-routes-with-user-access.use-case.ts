import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import type { PaginationQuery } from '../../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../../common/types/pagination.types';
import { paginate } from '../../../common/utils/paginate.util';
import { isRoleAllowedForRoute } from '../../../common/utils/route-roles.util';
import { RouteCeilingRegistry } from '../../../common/infrastructure/route-ceiling/route-ceiling.registry';

interface UserRouteAccessInfo {
  id: string;
  grantedBy: string | null;
  createdAt: Date;
  denied: boolean;
}

interface RoleRouteAccessInfo {
  roleId: string;
}

interface RouteWithAccess {
  id: string;
  path: string;
  labelKey: string;
  icon: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  userRouteAccesses: UserRouteAccessInfo[];
  roleRouteAccesses: RoleRouteAccessInfo[];
}

export interface MappedRoute {
  id: string;
  path: string;
  labelKey: string;
  icon: string | null;
  isActive: boolean;
  hasAccess: boolean;
  denied: boolean;
  fromRole: boolean;
  accessInfo: UserRouteAccessInfo | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class FindAllRoutesWithUserAccessUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly routeCeilings: RouteCeilingRegistry,
  ) {}

  async execute(
    userId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<MappedRoute> | MappedRoute[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        roleId: true,
        roleRecord: { select: { name: true } },
      },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }

    const { search } = query;

    const where = search
      ? {
          OR: [
            { path: { contains: search } },
            { labelKey: { contains: search } },
          ],
        }
      : {};

    const include = {
      userRouteAccesses: {
        where: { userId },
        select: { id: true, grantedBy: true, createdAt: true, denied: true },
      },
      roleRouteAccesses: {
        where: { roleId: user.roleId ?? '' },
        select: { roleId: true },
      },
    };

    const mapRoute = (route: RouteWithAccess): MappedRoute => {
      const userAccess = route.userRouteAccesses[0] ?? null;
      const fromRole = route.roleRouteAccesses.length > 0;
      const hasAccess = userAccess ? !userAccess.denied : fromRole;

      return {
        id: route.id,
        path: route.path,
        labelKey: route.labelKey,
        icon: route.icon,
        isActive: route.isActive,
        hasAccess,
        denied: userAccess?.denied ?? false,
        fromRole,
        accessInfo: userAccess,
        createdAt: route.createdAt.toISOString(),
        updatedAt: route.updatedAt.toISOString(),
      };
    };

    // O teto vem do registro em código (RouteCeilingRegistry), não do banco — filtra aqui,
    // não na query, por isso a paginação abaixo pagina o array já filtrado.
    const candidates = (await this.prisma.route.findMany({
      where,
      include,
      orderBy: { path: 'asc' },
    })) as unknown as RouteWithAccess[];
    const eligible = candidates.filter((route) =>
      isRoleAllowedForRoute(
        this.routeCeilings.allowedRolesFor(route.path),
        user.roleRecord?.name,
      ),
    );

    return paginate(query, {
      findMany: ({ skip, take }) =>
        Promise.resolve(
          eligible.slice(skip ?? 0, (skip ?? 0) + (take ?? eligible.length)),
        ),
      count: () => Promise.resolve(eligible.length),
      map: mapRoute,
    });
  }
}
