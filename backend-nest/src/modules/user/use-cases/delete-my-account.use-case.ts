import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from '../../../domain/logging/log-actions';

@Injectable()
export class DeleteMyAccountUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly cryptoService: CryptoService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException(this.i18n.t('user.not_found'));

    const isValid =
      user.hash && user.salt
        ? await this.cryptoService.verifyPassword(
            password,
            user.hash,
            user.salt,
          )
        : false;
    if (!isValid)
      throw new UnauthorizedException(
        this.i18n.t('auth.login.invalid_credentials'),
      );

    await this.loggingService.create(
      {
        module: 'AUTH',
        action: LogActions.ACCOUNT_DELETED,
        message: `Conta ${user.email} excluída`,
        metadata: { userId },
      },
      userId,
    );

    const anonEmail = `deleted-${userId}@anonymized.local`;
    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.passwordResetToken.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: anonEmail,
          name: null,
          phone: null,
          image: null,
          hash: null,
          salt: null,
          status: 'INACTIVE',
          deletedAt: new Date(),
        },
      }),
    ]);
  }
}
