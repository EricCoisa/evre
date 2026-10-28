import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';

@Injectable()
export class RemoveRoleRouteAccessUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(performedById: string, roleId: string, routeId: string) {
    const access = await this.prisma.roleRouteAccess.findUnique({
      where: {
        roleId_routeId: {
          roleId,
          routeId,
        },
      },
      include: {
        route: {
          select: {
            path: true,
            labelKey: true,
          },
        },
      },
    });

    if (!access) {
      throw new NotFoundException(this.i18n.t('role_route_access.not_found'));
    }

    await this.prisma.roleRouteAccess.delete({
      where: {
        roleId_routeId: {
          roleId,
          routeId,
        },
      },
    });

    await this.loggingService.create(
      {
        module: 'ROLE_ROUTE_ACCESS',
        action: LogActions.DELETE,
        message: `Acesso à rota ${access.route.path} revogado do role ${roleId}`,
        metadata: {
          roleId,
          routeId,
          routePath: access.route.path,
          routeLabelKey: access.route.labelKey,
        },
      },
      performedById,
    );

    return { status: true, message: this.i18n.t('role_route_access.deleted') };
  }
}
