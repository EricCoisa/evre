import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import type { PaginationQuery } from '../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import type { RoleRouteAccessDto } from './dto/role-route-access.dto';
import type { CreateRoleRouteAccessDto } from './dto/create-role-route-access.dto';
import { UserRoleDto } from './dto/user-role.dto';
import { UserRole, UserRoleConst } from 'src/domain/auth/userRole.const';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/common/types/logging.types';
import { IBaseService } from 'src/domain/interface/base-service.interface';
import { RoleRouteAccess } from 'src/domain/role-route-acess/role-route-acess.entity';
import { RouteSelect } from 'src/domain/route/route.select';

@Injectable()
export class RoleRouteAccessService implements Omit<
  IBaseService<RoleRouteAccess>,
  'update'
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  //TODO: OK
  async findAll(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<RoleRouteAccess> | RoleRouteAccess[]> {
    const { page, limit, pagination } = query;

    const include = {
      route: {
        select: RouteSelect,
      },
    };

    if (!pagination) {
      const accesses = await this.prisma.roleRouteAccess.findMany({
        include,
        orderBy: [{ roleId: 'asc' }, { routeId: 'asc' }],
      });

      return accesses;
    }

    const skip = (page - 1) * limit;

    const [accesses, total] = await Promise.all([
      this.prisma.roleRouteAccess.findMany({
        skip,
        take: limit,
        include,
        orderBy: [{ roleId: 'asc' }, { routeId: 'asc' }],
      }),
      this.prisma.roleRouteAccess.count(),
    ]);

    return {
      data: accesses,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  //TODO: OK
  async findOne(roleId: string, routeId: string) {
    const access = await this.prisma.roleRouteAccess.findUnique({
      where: {
        roleId_routeId: {
          roleId: roleId as UserRole,
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

  //TODO: OK
  async create(
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

    // Log da ação
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

  //TODO: OK
  async remove(performedById: string, roleId: string, routeId: string) {
    const access = await this.prisma.roleRouteAccess.findUnique({
      where: {
        roleId_routeId: {
          roleId: roleId as UserRole,
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
          roleId: roleId as UserRole,
          routeId,
        },
      },
    });

    // Log da ação
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

  //TODO: ok
  findAllUserRole(
    query: PaginationQuery,
  ): PaginatedResponse<UserRoleDto> | UserRoleDto[] {
    const { page, limit, pagination } = query;

    // Converte enum UserRole em array de objetos UserRoleDto
    const allRoles: UserRoleDto[] = Object.values(UserRoleConst).map(
      (role) => ({
        roleId: role as UserRole,
      }),
    );

    if (!pagination) {
      return allRoles;
    }

    // Implementa paginação manual
    const skip = (page - 1) * limit;
    const paginatedRoles = allRoles.slice(skip, skip + limit);
    const total = allRoles.length;

    return {
      data: paginatedRoles,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  //TODO: ok
  async findByRole(
    roleId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<RoleRouteAccessDto> | RoleRouteAccessDto[]> {
    const { page, limit, pagination, search } = query;

    const where = search
      ? {
          OR: [
            {
              path: { contains: search },
            },
            { labelKey: { contains: search } },
          ],
        }
      : {};

    if (!pagination) {
      const routes = await this.prisma.route.findMany({
        where,
        include: {
          roleRouteAccesses: {
            where: { roleId: roleId as UserRole },
            select: {
              roleId: true,
              routeId: true,
            },
          },
        },
        orderBy: { path: 'asc' },
      });

      return routes.map((route) => ({
        id: route.id,
        path: route.path,
        labelKey: route.labelKey,
        icon: route.icon,
        isActive: route.isActive,
        hasAccess: route.roleRouteAccesses.length > 0,
        roleId: roleId as UserRole,
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
      }));
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.route.findMany({
        where,
        include: {
          roleRouteAccesses: {
            where: { roleId: roleId as UserRole },
            select: {
              roleId: true,
              routeId: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { path: 'asc' },
      }),
      this.prisma.route.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data.map((route) => ({
        id: route.id,
        path: route.path,
        labelKey: route.labelKey,
        icon: route.icon,
        isActive: route.isActive,
        hasAccess: route.roleRouteAccesses.length > 0,
        roleId: roleId as UserRole,
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
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  //TODO: ok
  async removeByRole(roleId: string, performedById: string) {
    const accesses = await this.prisma.roleRouteAccess.findMany({
      where: {
        roleId: roleId as UserRole,
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

    const result = await this.prisma.roleRouteAccess.deleteMany({
      where: {
        roleId: roleId as UserRole,
      },
    });

    // Log da ação
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
