import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import type { CreateRoleRouteAccessDto } from '../dto/create-role-route-access.dto';
import { RoleRouteAccess } from 'src/domain/role-route-access/role-route-access.entity';
import { RouteSelect } from 'src/domain/route/route.select';
import { LogActions } from 'src/domain/logging/log-actions';
import { isRoleAllowedForRoute } from 'src/common/utils/route-roles.util';
import { RouteCeilingRegistry } from 'src/common/infrastructure/route-ceiling/route-ceiling.registry';

@Injectable()
export class CreateRoleRouteAccessUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly routeCeilings: RouteCeilingRegistry,
  ) {}

  async execute(
    data: CreateRoleRouteAccessDto,
    performedById: string,
  ): Promise<RoleRouteAccess> {
    // Verifica se a rota existe
    const route = await this.prisma.route.findUnique({
      where: { id: data.routeId },
    });

    if (!route) {
      throw new NotFoundException(this.i18n.t('route.not_found'));
    }

    const role = await this.prisma.role.findUnique({
      where: { id: data.roleId },
    });

    if (!role) {
      throw new NotFoundException(this.i18n.t('role.not_found'));
    }

    // Rejeita a concessão quando o papel está fora do teto registrado para a rota.
    const allowedRoles = this.routeCeilings.allowedRolesFor(route.path);
    if (!isRoleAllowedForRoute(allowedRoles, role.name)) {
      throw new ForbiddenException(
        this.i18n.t('route.role_not_allowed', {
          args: { path: route.path, roles: allowedRoles.join(', ') },
        }),
      );
    }

    // Verifica se já existe o acesso
    const existing = await this.prisma.roleRouteAccess.findUnique({
      where: {
        roleId_routeId: {
          roleId: data.roleId,
          routeId: data.routeId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        this.i18n.t('role_route_access.already_exists'),
      );
    }

    const access = await this.prisma.roleRouteAccess.create({
      data: {
        roleId: data.roleId,
        routeId: data.routeId,
      },
      include: {
        route: {
          select: RouteSelect,
        },
      },
    });

    await this.loggingService.create(
      {
        module: 'ROLE_ROUTE_ACCESS',
        action: LogActions.CREATE,
        message: `Acesso à rota ${route.path} concedido ao role ${data.roleId}`,
        metadata: {
          roleId: data.roleId,
          routeId: route.id,
          routePath: route.path,
          routeLabelKey: route.labelKey,
        },
      },
      performedById,
    );

    return access;
  }
}
