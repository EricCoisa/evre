import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RouteCeilingRegistry } from '../../../common/infrastructure/route-ceiling/route-ceiling.registry';
import { isRoleAllowedForRoute } from '../../../common/utils/route-roles.util';
import { RoutePathConst } from '../../../domain/route/route-path.const';

@Injectable()
export class CheckCmsAccessUseCase {
  constructor(
    private prisma: PrismaService,
    private readonly routeCeilings: RouteCeilingRegistry,
  ) {}

  async execute(userId: string, roleId: string | null): Promise<boolean> {
    const cmsRoute = await this.prisma.route.findFirst({
      where: { path: RoutePathConst.CMS, isActive: true },
    });
    if (!cmsRoute) return false;

    const role = roleId
      ? await this.prisma.role.findUnique({ where: { id: roleId } })
      : null;
    const allowedRoles = this.routeCeilings.allowedRolesFor(RoutePathConst.CMS);
    if (!isRoleAllowedForRoute(allowedRoles, role?.name)) return false;

    const [userAccess, roleAccess] = await Promise.all([
      this.prisma.userRouteAccess.findFirst({
        where: { userId, routeId: cmsRoute.id },
      }),
      roleId
        ? this.prisma.roleRouteAccess.findFirst({
            where: { roleId, routeId: cmsRoute.id },
          })
        : Promise.resolve(null),
    ]);

    return !!userAccess || !!roleAccess;
  }
}
