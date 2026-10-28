import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';
import { UserStatusConst } from '../../../domain/auth/userStatus.const';
import { LogActions } from 'src/domain/logging/log-actions';
import type { UserPayload } from '../../../common/types/auth.types';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

@Injectable()
export class ValidateUserUseCase {
  constructor(
    private prisma: PrismaService,
    private cryptoService: CryptoService,
    private loggingService: LoggingService,
    private i18n: I18nService,
  ) {}

  async execute(email: string, password: string): Promise<UserPayload | null> {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { roleRecord: { select: { name: true } } },
    });

    // Always hash to prevent timing attacks even when user not found
    const fakeSalt = 'fakeSaltToPreventTimingAttack1234567890';
    const fakeHash = 'fakeHashToPreventTimingAttack1234567890';
    const isPasswordValid = await this.cryptoService.verifyPassword(
      password,
      user?.hash || fakeHash,
      user?.salt || fakeSalt,
    );

    if (!user || !isPasswordValid) {
      if (user) {
        const newAttempts = (user.loginAttempts || 0) + 1;
        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
          const lockUntil = new Date(
            Date.now() + LOCK_DURATION_MINUTES * 60 * 1000,
          );
          await this.prisma.user.update({
            where: { id: user.id },
            data: { loginAttempts: 0, lockUntil },
          });
          await this.loggingService.create(
            {
              module: 'AUTH',
              action: LogActions.ACCOUNT_LOCKED,
              message: `Conta ${user.email} bloqueada por ${LOCK_DURATION_MINUTES}min`,
              metadata: { userId: user.id },
            },
            user.id,
          );
        } else {
          await this.prisma.user.update({
            where: { id: user.id },
            data: { loginAttempts: newAttempts },
          });
        }
      }
      return null;
    }

    // Só confere o bloqueio depois de validar a senha.
    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutes = Math.ceil(
        (user.lockUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        this.i18n.t('auth.login.account_locked', { args: { minutes } }),
      );
    }

    if (user.loginAttempts > 0 || user.lockUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockUntil: null },
      });
    }

    if (user.status === UserStatusConst.INACTIVE) return null;
    if (user.status === UserStatusConst.SUSPENDED) {
      throw new ForbiddenException(this.i18n.t('auth.login.user_suspended'));
    }
    if (user.status !== UserStatusConst.ACTIVE) return null;

    return {
      ...user,
      roleId: user.roleId ?? null,
      roleName: user.roleRecord?.name ?? 'USER',
    };
  }
}
