import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';
import { LogActions } from 'src/domain/logging/log-actions';
import { jwtExp } from '../../../common/utils/jwt-exp.util';
import {
  hashSource,
  type RequestSource,
} from '../../../common/utils/request-source.util';

/** `expiresIn` do jsonwebtoken é um literal (`'15m'`), não `string` solto. */
type Expiry = JwtSignOptions['expiresIn'];

@Injectable()
export class LoginUseCase {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private loggingService: LoggingService,
    private i18n: I18nService,
  ) {}

  async execute(user: { id: string; email: string }, source: RequestSource) {
    const userWithRole = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { roleId: true, roleRecord: { select: { name: true } } },
    });

    const roleId = userWithRole?.roleId ?? null;
    const roleName = userWithRole?.roleRecord?.name ?? 'USER';

    const payload = { sub: user.id, email: user.email, roleId, roleName };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ??
        '15m') as Expiry,
    });

    const refreshToken = await this.jwtService.signAsync(
      // O jti distingue dois refresh tokens assinados no mesmo segundo, que sem ele
      // teriam payload idêntico e colidiriam com o @unique de `token`.
      { ...payload, jti: randomUUID() },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ??
          '7d') as Expiry,
      },
    );

    // expiresAt segue o `exp` do próprio token — validateRefreshToken checa a linha
    // do banco, então uma constante separada sairia de sincronia com a TTL configurada.
    const expiresAt = new Date(jwtExp(refreshToken) * 1000);

    await this.prisma.refreshToken.create({
      // Cada login abre uma família nova; as rotações seguintes herdam este id.
      data: {
        token: refreshToken,
        userId: user.id,
        familyId: randomUUID(),
        expiresAt,
        sourceIpHash: hashSource(source.ip),
        sourceUaHash: hashSource(source.userAgent),
      },
    });

    await this.loggingService.create(
      {
        module: 'AUTH',
        action: LogActions.LOGIN,
        message: `Usuário ${user.email} efetuou login`,
        metadata: {
          userId: user.id,
          userEmail: user.email,
          roleName,
        },
      },
      user.id,
    );

    return { accessToken, refreshToken };
  }
}
