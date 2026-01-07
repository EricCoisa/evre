import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { UserRole } from 'src/domain/auth/userRole.const';
import { UserStatusConst } from 'src/domain/auth/userStatus.const';

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private i18n: I18nService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Tenta extrair do cookie primeiro
        (request: Request) => {
          return (request?.cookies?.access_token as string) || null;
        },
        // Fallback para Authorization header (útil para Swagger/Postman)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'secret',
    });
  }

  async validate(payload: JwtPayload) {
    // Busca usuário no banco para verificar status atual
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, status: true },
    });

    // Usuário não encontrado
    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.token.invalid'));
    }

    // Verifica se usuário está ativo
    if (user.status !== UserStatusConst.ACTIVE) {
      throw new UnauthorizedException(
        this.i18n.t('auth.login.user_not_active'),
      );
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
