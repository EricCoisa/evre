import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';
import { PayloadUserRepository } from '../../../modules/auth/adapters/payload-user.repository';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';

@Injectable()
export class EnsurePayloadUserAndLoginUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
    private readonly payloadUserRepo: PayloadUserRepository,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(userId: string): Promise<{ email: string; password: string }> {
    // Busca o usuário no schema public
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('user.not_found'));
    }

    // Verifica se o usuário está ativo
    if (user.status !== 'ACTIVE') {
      throw new NotFoundException(
        this.i18n.t('cms.user_inactive', {
          lang: 'en',
          defaultValue: 'User is not active',
        }),
      );
    }

    // Senha master do CMS (todos os PayloadUsers usam a mesma)
    const cmsMasterPassword = this.configService.get<string>(
      'PAYLOAD_CMS_PASSWORD',
    );

    if (!cmsMasterPassword) {
      throw new Error(
        'PAYLOAD_CMS_PASSWORD not configured in environment variables',
      );
    }

    // Busca ou cria PayloadUser com mesmo email
    let payloadUser = await this.payloadUserRepo.findByEmail(user.email);

    if (!payloadUser) {
      // Gera hash/salt da senha master do CMS
      const { hash, salt } =
        await this.cryptoService.generatePasswordHash(cmsMasterPassword);

      // Cria PayloadUser com a senha master
      payloadUser = await this.payloadUserRepo.create({
        email: user.email,
        hash,
        salt,
        loginAttempts: 0,
        lockUntil: null,
      });

      await this.loggingService.create(
        {
          module: 'CMS',
          action: LogActions.CREATE,
          message: `PayloadUser auto-created from User: ${user.email}`,
          metadata: { payloadUserId: payloadUser.id, sourceUserId: userId },
        },
        userId,
      );
    } else {
      // Verifica se o PayloadUser está bloqueado
      if (payloadUser.lockUntil && payloadUser.lockUntil > new Date()) {
        throw new NotFoundException(
          this.i18n.t('cms.user_locked', {
            lang: 'en',
            defaultValue:
              'User is locked in CMS. This may be due to inactive status in the main system.',
          }),
        );
      }
    }

    // Retorna email e senha master para fazer login no Payload
    return {
      email: user.email,
      password: cmsMasterPassword,
    };
  }
}
