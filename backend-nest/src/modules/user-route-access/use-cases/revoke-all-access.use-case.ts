import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { PayloadUserRepository } from '../../../modules/auth/adapters/payload-user.repository';
import { RedisService } from '../../../common/infrastructure/redis/redis.service';

@Injectable()
export class RevokeAllAccessUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly payloadUserRepo: PayloadUserRepository,
    private readonly redis: RedisService,
  ) {}

  async execute(userId: string, performedById: string) {
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
      denied: access.denied,
    }));

    const result = await this.prisma.userRouteAccess.deleteMany({
      where: { userId },
    });

    await this.redis.del(`user:routes:${userId}`);

    // Só linha ALLOW de /cms justifica bloquear o PayloadUser: revogar um DENY não
    // tira acesso de ninguém, e bloquear ali trancava por 100 anos quem nunca teve CMS.
    const hasCmsAllow = revokedRoutes.some(
      (route) => route.path === '/cms' && !route.denied,
    );
    if (hasCmsAllow) {
      const payloadUser = await this.payloadUserRepo.findByEmail(user.email);

      if (payloadUser) {
        // Bloqueia por 100 anos
        const lockDate = new Date();
        lockDate.setFullYear(lockDate.getFullYear() + 100);

        await this.payloadUserRepo.updateById(payloadUser.id, {
          lockUntil: lockDate,
        });

        await this.loggingService.create(
          {
            module: 'USER_ROUTE_ACCESS',
            action: LogActions.UPDATE,
            message: `PayloadUser bloqueado ao revogar todos os acessos de ${user.email} (incluindo /cms)`,
            metadata: {
              payloadUserId: payloadUser.id,
              userEmail: user.email,
            },
          },
          performedById,
        );
      }
    }

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
}
