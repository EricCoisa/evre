import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { RouteSelect } from 'src/domain/route/route.select';

@Injectable()
export class FindOneRoleRouteAccessUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(roleId: string, routeId: string) {
    const access = await this.prisma.roleRouteAccess.findUnique({
      where: {
        roleId_routeId: {
          roleId,
          routeId,
        },
      },
      include: {
        route: {
          select: RouteSelect,
        },
      },
    });

    if (!access) {
      throw new NotFoundException(this.i18n.t('role_route_access.not_found'));
    }

    return access;
  }
}
