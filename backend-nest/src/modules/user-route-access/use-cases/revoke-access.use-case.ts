import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { PayloadUserRepository } from '../../../modules/auth/adapters/payload-user.repository';
import { RedisService } from '../../../common/infrastructure/redis/redis.service';

@Injectable()
export class RevokeAccessUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly payloadUserRepo: PayloadUserRepository,
    private readonly redis: RedisService,
  ) {}

  async execute(userId: string, routeId: string, performedById: string) {
    const [user, route] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      }),
      this.prisma.route.findUnique({
        where: { id: routeId },
        select: { id: true, path: true, labelKey: true },
      }),
    ]);

    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }

    if (!route) {
      throw new NotFoundException(this.i18n.t('route.not_found'));
    }

    const existing = await this.prisma.userRouteAccess.findUnique({
      where: { userId_routeId: { userId, routeId } },
    });

    if (existing?.denied) {
      // Idempotente — já está negado
      return { message: this.i18n.t('user_route_access.revoked_successfully') };
    }

    if (existing) {
      // Tinha ALLOW → converte em DENY
      await this.prisma.userRouteAccess.update({
        where: { userId_routeId: { userId, routeId } },
        data: { denied: true },
      });
    } else {
      // Sem linha individual (acesso vinha da role) → cria DENY
      await this.prisma.userRouteAccess.create({
        data: { userId, routeId, denied: true, grantedBy: performedById },
      });
    }

    await this.redis.del(`user:routes:${userId}`);

    if (route.path === '/cms') {
      const payloadUser = await this.payloadUserRepo.findByEmail(user.email);

      if (payloadUser) {
        const lockDate = new Date();
        lockDate.setFullYear(lockDate.getFullYear() + 100);

        await this.payloadUserRepo.updateById(payloadUser.id, {
          lockUntil: lockDate,
        });

        await this.loggingService.create(
          {
            module: 'USER_ROUTE_ACCESS',
            action: LogActions.UPDATE,
            message: `PayloadUser bloqueado ao revogar acesso /cms de ${user.email}`,
            metadata: { payloadUserId: payloadUser.id, userEmail: user.email },
          },
          performedById,
        );
      }
    }

    await this.loggingService.create(
      {
        module: 'USER_ROUTE_ACCESS',
        action: LogActions.REVOKE,
        message: `Acesso à rota ${route.path} negado ao usuário ${user.email}`,
        metadata: {
          userId,
          userEmail: user.email,
          routeId,
          routePath: route.path,
          routeLabelKey: route.labelKey,
        },
      },
      performedById,
    );

    return { message: this.i18n.t('user_route_access.revoked_successfully') };
  }
}
