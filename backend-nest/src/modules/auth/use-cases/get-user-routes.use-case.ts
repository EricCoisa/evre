import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RoleHomeService } from 'src/modules/route/role-home.service';

interface RouteWithRelation {
  id: string;
  path: string;
  labelKey: string;
  icon: string | null;
  parentId: string | null;
  ordem: number;
  isActive: boolean;
  showSideBar: boolean;
}

interface RoleRouteWithRoute {
  roleId: string;
  routeId: string;
  route: RouteWithRelation;
}

interface UserRouteWithRoute {
  denied: boolean;
  route: RouteWithRelation;
}

@Injectable()
export class GetUserRoutesUseCase {
  constructor(
    private prisma: PrismaService,
    private readonly roleHome: RoleHomeService,
  ) {}

  async execute(
    userId: string,
    roleId: string | null,
    roleName?: string | null,
  ) {
    // `isHome` é derivado da configuração por role, não de coluna: uma rota é home
    // para uma role e comum para outra, e o front só precisa do resultado.
    const homeRouteId = await this.roleHome.routeIdFor(roleName);
    const [roleRoutes, userRoutes] = await Promise.all([
      roleId
        ? (this.prisma.roleRouteAccess.findMany({
            where: { roleId },
            include: { route: true },
          }) as Promise<RoleRouteWithRoute[]>)
        : Promise.resolve<RoleRouteWithRoute[]>([]),
      this.prisma.userRouteAccess.findMany({
        where: { userId },
        include: { route: true },
      }) as Promise<UserRouteWithRoute[]>,
    ]);

    const routeMap = new Map<
      string,
      {
        id: string;
        path: string;
        labelKey: string;
        icon?: string | null;
        parentId: string | null;
        ordem: number;
        isHome: boolean;
        isActive: boolean;
        showSideBar: boolean;
      }
    >();

    roleRoutes.forEach((rr) => {
      if (rr.route?.isActive) {
        routeMap.set(rr.route.id, {
          id: rr.route.id,
          path: rr.route.path,
          labelKey: rr.route.labelKey,
          icon: rr.route.icon,
          parentId: rr.route.parentId,
          ordem: rr.route.ordem,
          isHome: rr.route.id === homeRouteId,
          isActive: rr.route.isActive,
          showSideBar: rr.route.showSideBar,
        });
      }
    });

    userRoutes.forEach((ur) => {
      if (!ur.route?.isActive) return;
      if (ur.denied) {
        // Override explícito: remove acesso herdado da role
        routeMap.delete(ur.route.id);
      } else {
        routeMap.set(ur.route.id, {
          id: ur.route.id,
          path: ur.route.path,
          labelKey: ur.route.labelKey,
          icon: ur.route.icon,
          parentId: ur.route.parentId,
          ordem: ur.route.ordem,
          isHome: ur.route.id === homeRouteId,
          isActive: ur.route.isActive,
          showSideBar: ur.route.showSideBar ?? false,
        });
      }
    });

    return Array.from(routeMap.values());
  }
}
