import { randomUUID } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { UserStatusConst } from '../../../domain/auth/userStatus.const';
import { jwtExp } from '../../../common/utils/jwt-exp.util';
import {
  hashSource,
  type RequestSource,
} from '../../../common/utils/request-source.util';

/** `expiresIn` do jsonwebtoken é um literal (`'15m'`), não `string` solto. */
type Expiry = JwtSignOptions['expiresIn'];

/** Janela em que um refresh token já rotacionado continua sendo aceito. */
export const REFRESH_REUSE_GRACE_MS = 30_000;

type Tokens = { accessToken: string; refreshToken: string };

@Injectable()
export class RefreshTokenUseCase {
  private readonly logger = new Logger(RefreshTokenUseCase.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private i18n: I18nService,
  ) {}

  /** Validates a refresh token stored in DB and returns the associated user */
  async validateRefreshToken(token: string) {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException(this.i18n.t('auth.token.invalid'));
    }

    if (tokenRecord.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
      throw new UnauthorizedException(this.i18n.t('auth.token.expired'));
    }

    if (tokenRecord.user.status !== UserStatusConst.ACTIVE) {
      await this.revokeFamily(tokenRecord.familyId);
      throw new UnauthorizedException(
        this.i18n.t('auth.login.user_not_active'),
      );
    }

    return tokenRecord.user;
  }

  /** Rotaciona o refresh token apresentado e devolve o par novo (rotação + detecção de reuso, RFC 9700 §4.14.2). */
  async rotate(presentedToken: string, source: RequestSource): Promise<Tokens> {
    const current = await this.prisma.refreshToken.findUnique({
      where: { token: presentedToken },
      include: {
        user: { include: { roleRecord: { select: { name: true } } } },
      },
    });

    if (!current) {
      throw new UnauthorizedException(this.i18n.t('auth.token.invalid'));
    }

    if (current.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: current.id } });
      throw new UnauthorizedException(this.i18n.t('auth.token.expired'));
    }

    if (current.user.status !== UserStatusConst.ACTIVE) {
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException(
        this.i18n.t('auth.login.user_not_active'),
      );
    }

    if (current.replacedAt) {
      return this.resolveReuse(
        current.id,
        current.familyId,
        current.user,
        source,
      );
    }

    // Emite o sucessor antes de marcar o antigo: `replacedAt` e `replacedById` gravam juntos.
    const next = await this.issueRefreshToken(
      current.user,
      current.familyId,
      source,
    );

    // Compare-and-swap: só a primeira requisição concorrente marca a linha.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: current.id, replacedAt: null },
      data: { replacedAt: new Date(), replacedById: next.id },
    });

    if (claimed.count === 0) {
      // Outra requisição rotacionou primeiro. Descarta o sucessor recém-criado
      // e entrega o do vencedor, para a família convergir num token só.
      await this.prisma.refreshToken
        .delete({ where: { id: next.id } })
        .catch(() => undefined);
      return this.resolveReuse(
        current.id,
        current.familyId,
        current.user,
        source,
      );
    }

    return {
      accessToken: await this.signAccessToken(current.user),
      refreshToken: next.token,
    };
  }

  /** Token já rotacionado: devolve o sucessor dentro da janela de graça e mesma origem, revoga a família fora disso. */
  private async resolveReuse(
    tokenId: string,
    familyId: string,
    user: { id: string; email: string; roleId: string | null },
    source: RequestSource,
  ): Promise<Tokens> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
    });

    const withinGrace =
      row?.replacedAt != null &&
      Date.now() - row.replacedAt.getTime() <= REFRESH_REUSE_GRACE_MS;

    // Exige a mesma origem (IP + User-Agent) do token original.
    const sameSource =
      row?.sourceIpHash === hashSource(source.ip) &&
      row?.sourceUaHash === hashSource(source.userAgent);

    if (withinGrace && sameSource && row?.replacedById) {
      const successor = await this.prisma.refreshToken.findUnique({
        where: { id: row.replacedById },
      });
      if (
        successor &&
        successor.replacedAt == null &&
        successor.expiresAt > new Date()
      ) {
        return {
          accessToken: await this.signAccessToken(user),
          refreshToken: successor.token,
        };
      }
    }

    this.logger.warn(
      `Reuso de refresh token fora da janela de graça ou de outra origem (user=${user.id}, family=${familyId}). Revogando a família.`,
    );
    await this.revokeFamily(familyId);
    throw new UnauthorizedException(this.i18n.t('auth.token.reuse_detected'));
  }

  /** Derruba a sessão inteira: todos os tokens descendentes do mesmo login. */
  async revokeFamily(familyId: string): Promise<number> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { familyId },
    });
    return count;
  }

  private async signAccessToken(user: {
    id: string;
    email: string;
    roleId: string | null;
    roleRecord?: { name: string } | null;
  }): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        roleId: user.roleId ?? null,
        roleName: user.roleRecord?.name ?? 'USER',
      },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ??
          '15m') as Expiry,
      },
    );
  }

  private async issueRefreshToken(
    user: {
      id: string;
      email: string;
      roleId: string | null;
      roleRecord?: { name: string } | null;
    },
    familyId: string,
    source: RequestSource,
  ) {
    const token = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        roleId: user.roleId ?? null,
        roleName: user.roleRecord?.name ?? 'USER',
        // Sem o jti, duas rotações no mesmo segundo assinariam payloads idênticos
        // e produziriam a mesma string — que colide com o @unique de `token`.
        jti: randomUUID(),
      },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ??
          '7d') as Expiry,
      },
    );

    return this.prisma.refreshToken.create({
      data: {
        token,
        userId: user.id,
        familyId,
        expiresAt: new Date(jwtExp(token) * 1000),
        sourceIpHash: hashSource(source.ip),
        sourceUaHash: hashSource(source.userAgent),
      },
    });
  }

  /** Generates a new access token for an existing userId (legacy path) */
  async execute(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roleRecord: { select: { name: true } } },
    });

    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.login.user_not_found'));
    }

    return { accessToken: await this.signAccessToken(user) };
  }
}
