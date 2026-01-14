import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import type { PaginationQuery } from '../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import type { CreateRouteDto } from './dto/create-route.dto';
import type { UpdateRouteDto } from './dto/update-route.dto';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/common/types/logging.types';
import { Route } from 'src/domain/route/route.entity';
import { IBaseService } from 'src/domain/interface/base-service.interface';
import { AuthenticatedUser } from 'src/common/types/auth.types';

@Injectable()
export class RouteService implements IBaseService<Route> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  //TODO: OK
  async findAll(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<Route> | Route[]> {
    const { page, limit, pagination, search } = query;

    const where = search
      ? {
          OR: [{ path: { contains: search } }, { label: { contains: search } }],
        }
      : {};

    if (!pagination) {
      const routes = await this.prisma.route.findMany({
        where,
        orderBy: [{ ordem: 'asc' }, { labelKey: 'asc' }],
        include: {
          parent: true,
        },
      });
      return routes.map((route) => ({
        ...route,
        createdAt: route.createdAt,
        updatedAt: route.updatedAt,
        parent: route.parent
          ? {
              ...route.parent,
            }
          : null,
      }));
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.route.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ ordem: 'asc' }, { labelKey: 'asc' }],
        include: {
          parent: true,
        },
      }),
      this.prisma.route.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data.map((route) => ({
        ...route,
        parent: route.parent
          ? {
              ...route.parent,
            }
          : null,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  //TODO: OK
  async findOne(id: string): Promise<Route> {
    const route = await this.prisma.route.findUnique({
      where: { id },
    });

    if (!route) {
      throw new NotFoundException(this.i18n.t('route.not_found'));
    }

    return route;
  }

  async findHome(user: AuthenticatedUser): Promise<Route> {
    const acessDeniedRoute = { path: '/access-denied' } as Route;
    const route = await this.prisma.route.findFirst({
      where: { isHome: true },
      include: {
        userRouteAccesses: {
          where: { userId: user.id },
          select: { id: true },
        },
        roleRouteAccesses: {
          where: { roleId: user.role },
          select: { roleId: true },
        },
      },
    });

    if (!route) {
      return acessDeniedRoute;
    }

    const hasUserAccess = route.userRouteAccesses.length > 0;
    const hasRoleAccess = route.roleRouteAccesses.length > 0;

    if (hasUserAccess || hasRoleAccess) {
      return acessDeniedRoute;
    }

    if (!route || !route.isActive) {
      return acessDeniedRoute;
    }

    if (!route) {
      throw new NotFoundException(this.i18n.t('route.not_found'));
    }

    return route;
  }

  //TODO: OK
  async create(dto: CreateRouteDto, performedById: string): Promise<Route> {
    // Verifica se já existe uma rota com esse path
    const existing = await this.prisma.route.findUnique({
      where: { path: dto.path },
    });

    if (existing) {
      throw new ConflictException(this.i18n.t('route.path_already_exists'));
    }

    // Valida se parentId existe
    if (dto.parentId) {
      const parent = await this.prisma.route.findUnique({
        where: { id: dto.parentId },
      });

      if (!parent) {
        throw new NotFoundException(this.i18n.t('route.parent_not_found'));
      }
    }

    // Se isHome for true, remove o isHome de outras rotas
    if (dto.isHome) {
      await this.prisma.route.updateMany({
        where: { isHome: true },
        data: { isHome: false },
      });
    }

    const route = await this.prisma.route.create({
      data: dto,
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'ROUTE',
        action: LogActions.CREATE,
        message: `Rota ${route.path} criada`,
        metadata: {
          routeId: route.id,
          path: route.path,
          labelKey: route.labelKey,
          parentId: route.parentId,
          isHome: route.isHome,
        },
      },
      performedById,
    );

    return route;
  }

  //TODO: OK
  async update(
    id: string,
    dto: UpdateRouteDto,
    performedById: string,
  ): Promise<Route> {
    const existing = await this.prisma.route.findUnique({ where: { id } });
    console.log('performedById', performedById);
    if (!existing) {
      throw new NotFoundException(this.i18n.t('route.not_found'));
    }

    // Verifica conflito de path se está sendo alterado
    if (dto.path && dto.path !== existing.path) {
      const pathConflict = await this.prisma.route.findUnique({
        where: { path: dto.path },
      });

      if (pathConflict) {
        throw new ConflictException(this.i18n.t('route.path_already_exists'));
      }
    }

    // Valida se parentId existe
    if (dto.parentId !== undefined) {
      if (dto.parentId && dto.parentId === id) {
        throw new ConflictException(
          this.i18n.t('route.cannot_be_parent_of_itself'),
        );
      }

      if (dto.parentId) {
        const parent = await this.prisma.route.findUnique({
          where: { id: dto.parentId },
        });

        if (!parent) {
          throw new NotFoundException(this.i18n.t('route.parent_not_found'));
        }
      }
    }

    // Garante que sempre exista pelo menos uma rota com isHome true
    if (dto.isHome !== undefined) {
      // Se está tentando remover o isHome da rota atual
      if (!dto.isHome && existing.isHome) {
        // Verifica se existe outra rota com isHome true
        const otherHome = await this.prisma.route.findFirst({
          where: { isHome: true, NOT: { id } },
        });
        if (!otherHome) {
          throw new ConflictException(
            this.i18n.t('route.must_have_at_least_one_home'),
          );
        }
      }
      // Se está setando isHome como true, remove o isHome de outras rotas
      if (dto.isHome) {
        await this.prisma.route.updateMany({
          where: { isHome: true, NOT: { id } },
          data: { isHome: false },
        });
      }
    }

    const route = await this.prisma.route.update({
      where: { id },
      data: dto,
    });

    return route;
  }

  //TODO: OK
  async remove(performedById: string, id: string) {
    const existing = await this.prisma.route.findUnique({
      where: { id },
      include: { children: true },
    });

    if (!existing) {
      throw new NotFoundException(this.i18n.t('route.not_found'));
    }

    if (existing.children.length > 0) {
      throw new ConflictException(this.i18n.t('route.has_children'));
    }

    await this.prisma.route.delete({ where: { id } });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'ROUTE',
        action: LogActions.DELETE,
        message: `Rota ${existing.path} removida`,
        metadata: {
          routeId: existing.id,
          path: existing.path,
          labelKey: existing.labelKey,
        },
      },
      performedById,
    );

    return { status: true, message: this.i18n.t('route.deleted_successfully') };
  }
}
