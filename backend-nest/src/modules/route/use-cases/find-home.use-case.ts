import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Route } from 'src/domain/route/route.entity';
import { AuthenticatedUser } from 'src/common/types/auth.types';
import { RoleHomeService } from '../role-home.service';

@Injectable()
export class FindHomeRouteUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roleHome: RoleHomeService,
  ) {}

  async execute(user: AuthenticatedUser): Promise<Route> {
    const acessDeniedRoute = { path: '/access-denied' } as Route;
    // Sem entrada para a role, não há home: cai em access-denied em vez de chutar outra tela.
    const routeId = await this.roleHome.routeIdFor(user.roleName);
    if (!routeId) return acessDeniedRoute;

    const route = await this.prisma.route.findFirst({
      where: { id: routeId },
      include: {
        userRouteAccesses: {
          where: { userId: user.id },
          select: { id: true },
        },
        roleRouteAccesses: {
          where: { roleId: user.roleId ?? '' },
          select: { roleId: true },
        },
      },
    });

    if (!route) {
      return acessDeniedRoute;
    }

    const hasUserAccess = route.userRouteAccesses.length > 0;
    const hasRoleAccess = route.roleRouteAccesses.length > 0;

    if (!hasUserAccess && !hasRoleAccess) {
      return acessDeniedRoute;
    }

    if (!route.isActive) {
      return acessDeniedRoute;
    }
    return route;
  }
}
