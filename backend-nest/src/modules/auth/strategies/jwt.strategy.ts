import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { UserStatusConst } from 'src/domain/auth/userStatus.const';

interface JwtPayload {
  sub: string;
  email: string;
  roleId?: string | null;
  roleName?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private i18n: I18nService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret)
      throw new Error('JWT_SECRET must be set — refusing to start without it');
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) =>
          (request?.cookies?.access_token as string) || null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        status: true,
        deletedAt: true,
        roleId: true,
        roleRecord: { select: { name: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.token.invalid'));
    }

    if (user.deletedAt !== null) {
      throw new UnauthorizedException(this.i18n.t('auth.token.invalid'));
    }

    if (user.status !== UserStatusConst.ACTIVE) {
      throw new UnauthorizedException(
        this.i18n.t('auth.login.user_not_active'),
      );
    }

    const roleName = user.roleRecord?.name ?? payload.roleName ?? 'USER';
    return {
      id: user.id,
      email: user.email,
      roleId: user.roleId ?? null,
      roleName,
    };
  }
}
