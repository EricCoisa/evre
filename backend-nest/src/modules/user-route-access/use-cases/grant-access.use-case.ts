import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { Route } from '@prisma/client';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { PayloadUserRepository } from '../../../modules/auth/adapters/payload-user.repository';
import { RedisService } from '../../../common/infrastructure/redis/redis.service';
import type { GrantUserRouteAccessDto } from '../dto/grant-user-route-access.dto';
import { isRoleAllowedForRoute } from 'src/common/utils/route-roles.util';
import { RouteCeilingRegistry } from 'src/common/infrastructure/route-ceiling/route-ceiling.registry';

@Injectable()
export class GrantAccessUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly payloadUserRepo: PayloadUserRepository,
    private readonly redis: RedisService,
    private readonly routeCeilings: RouteCeilingRegistry,
  ) {}

  async execute(dto: GrantUserRouteAccessDto, performedById: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { roleRecord: true },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }

    const route = await this.prisma.route.findUnique({
      where: { id: dto.routeId },
    });

    if (!route) {
      throw new NotFoundException(this.i18n.t('route.not_found'));
    }

    // Rejeita a concessão quando o papel do usuário está fora do teto registrado para a rota.
    const allowedRoles = this.routeCeilings.allowedRolesFor(route.path);
    if (!isRoleAllowedForRoute(allowedRoles, user.roleRecord?.name)) {
      throw new ForbiddenException(
        this.i18n.t('route.role_not_allowed', {
          args: { path: route.path, roles: allowedRoles.join(', ') },
        }),
      );
    }

    const existing = await this.prisma.userRouteAccess.findUnique({
      where: { userId_routeId: { userId: dto.userId, routeId: dto.routeId } },
    });

    if (existing) {
      if (!existing.denied) {
        throw new ConflictException(
          this.i18n.t('user_route_access.already_granted'),
        );
      }
      // Tinha DENY override → limpa para ALLOW
      const access = await this.prisma.userRouteAccess.update({
        where: { userId_routeId: { userId: dto.userId, routeId: dto.routeId } },
        data: { denied: false, grantedBy: performedById },
        include: {
          user: { select: { id: true, email: true, name: true } },
          route: { select: { id: true, path: true, labelKey: true } },
          grantedByUser: { select: { id: true, email: true, name: true } },
        },
      });

      await this.redis.del(`user:routes:${dto.userId}`);
      await this.loggingService.create(
        {
          module: 'USER_ROUTE_ACCESS',
          action: LogActions.GRANT,
          message: `Negação da rota ${route.path} revertida para acesso do usuário ${user.email}`,
          metadata: {
            userId: user.id,
            userEmail: user.email,
            routeId: route.id,
            routePath: route.path,
          },
        },
        performedById,
      );

      if (route.path === '/cms' && user.status === 'ACTIVE') {
        const payloadUser = await this.payloadUserRepo.findByEmail(user.email);
        if (payloadUser) {
          await this.payloadUserRepo.updateById(payloadUser.id, {
            lockUntil: null,
            loginAttempts: 0,
          });
        }
      }

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

    const access = await this.prisma.userRouteAccess.create({
      data: {
        userId: dto.userId,
        routeId: dto.routeId,
        grantedBy: performedById,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        route: { select: { id: true, path: true, labelKey: true } },
        grantedByUser: { select: { id: true, email: true, name: true } },
      },
    });

    await this.redis.del(`user:routes:${dto.userId}`);

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

    if (route.path === '/cms' && user.status === 'ACTIVE') {
      const payloadUser = await this.payloadUserRepo.findByEmail(user.email);

      if (payloadUser) {
        await this.payloadUserRepo.updateById(payloadUser.id, {
          lockUntil: null,
          loginAttempts: 0,
        });

        await this.loggingService.create(
          {
            module: 'USER_ROUTE_ACCESS',
            action: LogActions.UPDATE,
            message: `PayloadUser desbloqueado ao conceder acesso /cms para ${user.email}`,
            metadata: { payloadUserId: payloadUser.id, userEmail: user.email },
          },
          performedById,
        );
      }
    }

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
}
