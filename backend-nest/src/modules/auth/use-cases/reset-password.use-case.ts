import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';
import { LogActions } from 'src/domain/logging/log-actions';
import * as crypto from 'crypto';

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    private prisma: PrismaService,
    private cryptoService: CryptoService,
    private loggingService: LoggingService,
    private i18n: I18nService,
  ) {}

  async validateResetToken(token: string): Promise<boolean> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, expiresAt: { gte: new Date() }, usedAt: null },
    });
    return !!record;
  }

  async execute(token: string, newPassword: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const passwordResetToken = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, expiresAt: { gte: new Date() }, usedAt: null },
      include: { user: true },
    });

    if (!passwordResetToken) {
      throw new BadRequestException(
        this.i18n.t('auth.password_reset.invalid_token'),
      );
    }

    const { hash, salt } =
      await this.cryptoService.generatePasswordHash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: passwordResetToken.userId },
        data: { salt, hash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: passwordResetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { userId: passwordResetToken.userId },
      }),
    ]);

    await this.loggingService.create(
      {
        module: 'AUTH',
        action: LogActions.PASSWORD_RESET_COMPLETED,
        message: `Senha redefinida com sucesso para ${passwordResetToken.user.email}`,
        metadata: {
          userId: passwordResetToken.user.id,
          email: passwordResetToken.user.email,
        },
      },
      passwordResetToken.userId,
    );
  }
}
