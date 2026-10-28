import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';

@Injectable()
export class RemoveByRoleUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(roleId: string, performedById: string) {
    const accesses = await this.prisma.roleRouteAccess.findMany({
      where: { roleId },
      include: {
        route: {
          select: {
            path: true,
            labelKey: true,
          },
        },
      },
    });

    const result = await this.prisma.roleRouteAccess.deleteMany({
      where: { roleId },
    });

    await this.loggingService.create(
      {
        module: 'ROLE_ROUTE_ACCESS',
        action: LogActions.DELETE_BY_ROLE,
        message: `Todos os acessos (${result.count}) revogados do role ${roleId}`,
        metadata: {
          roleId,
          totalRevoked: result.count,
          revokedRoutes: accesses.map((a) => ({
            path: a.route.path,
            labelKey: a.route.labelKey,
          })),
        },
      },
      performedById,
    );

    return {
      message: this.i18n.t('role_route_access.deleted_bulk'),
      count: result.count,
    };
  }
}
