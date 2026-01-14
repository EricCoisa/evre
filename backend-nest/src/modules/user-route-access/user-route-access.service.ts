import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import type { PaginationQuery } from '../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import type { UserRouteAccessDto } from './dto/user-route-access.dto';
import type { GrantUserRouteAccessDto } from './dto/grant-user-route-access.dto';
import { Route } from '@prisma/client';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/common/types/logging.types';
import { IBaseService } from 'src/domain/interface/base-service.interface';

@Injectable()
export class UserRouteAccessService implements Omit<
  IBaseService<UserRouteAccessDto>,
  'create' | 'update' | 'remove' | 'findOne'
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async findAll(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<UserRouteAccessDto> | UserRouteAccessDto[]> {
    const { page, limit, pagination, search } = query;

    const where = search
      ? {
          OR: [
            { user: { email: { contains: search } } },
            { user: { name: { contains: search } } },
            { route: { labelKey: { contains: search } } },
            { route: { path: { contains: search } } },
          ],
        }
      : {};

    const include = {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      route: {
        select: {
          id: true,
          path: true,
          labelKey: true,
        },
      },
      grantedByUser: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    };

    if (!pagination) {
      const accesses = await this.prisma.userRouteAccess.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
      });
      return accesses.map((access) => ({
        ...access,
        route: access.route
          ? {
              id: access.route.id,
              path: access.route.path,
              labelKey: (access.route as Route).labelKey,
            }
          : undefined,
        createdAt: access.createdAt.toISOString(),
      }));
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.userRouteAccess.findMany({
        where,
        include,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userRouteAccess.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data.map((access) => ({
        ...access,
        route: access.route
          ? {
              id: access.route.id,
              path: access.route.path,
              labelKey: (access.route as Route).labelKey,
            }
          : undefined,
        createdAt: access.createdAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findAllByOne(
    userId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<UserRouteAccessDto> | UserRouteAccessDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }

    const { page, limit, pagination } = query;

    const where = { userId };

    const include = {
      route: {
        select: {
          id: true,
          path: true,
          labelKey: true,
          isActive: true,
        },
      },
    };

    if (!pagination) {
      const accesses = await this.prisma.userRouteAccess.findMany({
        where,
        include,
        orderBy: { route: { path: 'asc' } },
      });

      return accesses.map((access) => ({
        ...access,
        route: access.route
          ? {
              id: access.route.id,
              path: access.route.path,
              labelKey: (access.route as Route).labelKey,
              isActive: access.route.isActive,
            }
          : undefined,
        createdAt: access.createdAt.toISOString(),
      }));
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.userRouteAccess.findMany({
        where,
        include,
        skip,
        take: limit,
        orderBy: { route: { path: 'asc' } },
      }),
      this.prisma.userRouteAccess.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data.map((access) => ({
        ...access,
        route: access.route
          ? {
              id: access.route.id,
              path: access.route.path,
              labelKey: (access.route as Route).labelKey,
              isActive: access.route.isActive,
            }
          : undefined,
        createdAt: access.createdAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async grant(dto: GrantUserRouteAccessDto, performedById: string) {
    // Verifica se o usuário existe
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }

    // Verifica se a rota existe
    const route = await this.prisma.route.findUnique({
      where: { id: dto.routeId },
    });

    if (!route) {
      throw new NotFoundException(this.i18n.t('route.not_found'));
    }

    // Verifica se já existe o acesso
    const existing = await this.prisma.userRouteAccess.findUnique({
      where: {
        userId_routeId: {
          userId: dto.userId,
          routeId: dto.routeId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        this.i18n.t('user_route_access.already_granted'),
      );
    }

    const access = await this.prisma.userRouteAccess.create({
      data: {
        userId: dto.userId,
        routeId: dto.routeId,
        grantedBy: performedById,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        route: {
          select: {
            id: true,
            path: true,
            labelKey: true,
          },
        },
        grantedByUser: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'USER_ROUTE_ACCESS',
        action: LogActions.GRANT,
        message: `Acesso à rota ${route.path} concedido ao usuário ${user.email}`,
        metadata: {
          userId: user.id,
          userEmail: user.email,
          routeId: route.id,
          routePath: route.path,
          routeLabelKey: route.labelKey,
        },
      },
      performedById,
    );

    return {
      ...access,
      route: access.route
        ? {
            id: access.route.id,
            path: access.route.path,
            labelKey: (access.route as Route).labelKey,
          }
        : undefined,
      createdAt: access.createdAt.toISOString(),
    };
  }

  async revoke(userId: string, routeId: string, performedById: string) {
    const access = await this.prisma.userRouteAccess.findUnique({
      where: {
        userId_routeId: {
          userId,
          routeId,
        },
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        route: {
          select: {
            path: true,
            labelKey: true,
          },
        },
      },
    });

    if (!access) {
      throw new NotFoundException(
        this.i18n.t('user_route_access.access_not_found'),
      );
    }

    await this.prisma.userRouteAccess.delete({
      where: {
        userId_routeId: {
          userId,
          routeId,
        },
      },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'USER_ROUTE_ACCESS',
        action: LogActions.REVOKE,
        message: `Acesso à rota ${access.route.path} revogado do usuário ${access.user.email}`,
        metadata: {
          userId,
          userEmail: access.user.email,
          routeId,
          routePath: access.route.path,
          routeLabelKey: access.route.labelKey,
        },
      },
      performedById,
    );

    return { message: this.i18n.t('user_route_access.revoked_successfully') };
  }

  async revokeAll(userId: string, performedById: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRouteAccesses: {
          include: {
            route: {
              select: {
                path: true,
                labelKey: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }

    const accessCount = user.userRouteAccesses.length;
    const revokedRoutes = user.userRouteAccesses.map((access) => ({
      path: access.route.path,
      labelKey: access.route.labelKey,
    }));

    const result = await this.prisma.userRouteAccess.deleteMany({
      where: { userId },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'USER_ROUTE_ACCESS',
        action: LogActions.BULK_REVOKE,
        message: `Todos os acessos (${accessCount}) revogados do usuário ${user.email}`,
        metadata: {
          userId,
          userEmail: user.email,
          totalRevoked: result.count,
          revokedRoutes,
        },
      },
      performedById,
    );

    return {
      message: this.i18n.t('user_route_access.all_revoked_successfully'),
      count: result.count,
    };
  }

  async findAllRoutesWithUserAccess(
    userId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<any> | any[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }

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
          userRouteAccesses: {
            where: { userId },
            select: {
              id: true,
              grantedBy: true,
              createdAt: true,
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
        hasAccess: route.userRouteAccesses.length > 0,
        accessInfo: route.userRouteAccesses[0] || null,
        createdAt: route.createdAt.toISOString(),
        updatedAt: route.updatedAt.toISOString(),
      }));
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.route.findMany({
        where,
        include: {
          userRouteAccesses: {
            where: { userId },
            select: {
              id: true,
              grantedBy: true,
              createdAt: true,
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
        hasAccess: route.userRouteAccesses.length > 0,
        accessInfo: route.userRouteAccesses[0] || null,
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

  /**
   * Verifica se o usuário tem acesso a uma rota específica
   * Considera tanto os acessos individuais do usuário quanto os acessos da role
   * @param userId - ID do usuário
   * @param path - Caminho da rota
   * @returns true se o usuário tem acesso, false caso contrário
   */
  async checkAccess(userId: string, path: string): Promise<boolean> {
    // Guard against empty or undefined path to prevent Prisma errors
    if (!path || path.trim() === '') {
      return false;
    }

    // Normaliza o path para considerar apenas o primeiro segmento após a barra inicial
    // Exemplo: '/rota/123' => '/rota'
    let normalizedPath = path;
    if (path.startsWith('/')) {
      const segments = path.split('/').filter(Boolean); // remove vazios
      if (segments.length > 0) {
        normalizedPath = '/' + segments[0];
      }
    }

    // Decode path se estiver encoded
    const decodedPath = decodeURIComponent(normalizedPath);

    // Busca o usuário com sua role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    console.log('1 User Route Access Check:', {
      userId,
      path,
      normalizedPath,
      decodedPath,
      user,
    });
    if (!user) {
      console.log('2 User Route Access Check: User not found');
      return false;
    }

    // Busca a rota com os acessos do usuário e da role
    const route = await this.prisma.route.findUnique({
      where: { path: decodedPath },
      include: {
        userRouteAccesses: {
          where: { userId },
          select: { id: true },
        },
        roleRouteAccesses: {
          where: { roleId: user.role },
          select: { roleId: true },
        },
      },
    });

    console.log('3 User Route Access Check: Route found', route);
    // Se a rota não existe ou está inativa, nega acesso
    if (!route || !route.isActive) {
      console.log('4 User Route Access Check: Route not found or inactive');
      return false;
    }

    // Usuário tem acesso se:
    // 1. Tem acesso individual (UserRouteAccess)
    // 2. Ou sua role tem acesso (RoleRouteAccess)
    const hasUserAccess = route.userRouteAccesses.length > 0;
    const hasRoleAccess = route.roleRouteAccesses.length > 0;

    console.log('5 User Route Access Check:', {
      hasUserAccess,
      hasRoleAccess,
    });
    return hasUserAccess || hasRoleAccess;
  }
}
