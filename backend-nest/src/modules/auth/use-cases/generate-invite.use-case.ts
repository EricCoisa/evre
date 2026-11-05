import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  ServiceUnavailableException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { ShortUrlService } from '../../short-url/short-url.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { InviteTokenPayload } from 'src/domain/auth/tokenInvite.type';
import { EmailTemplateType } from 'src/domain/mail/email-template-type.const';
import { createHash } from 'node:crypto';

@Injectable()
export class GenerateInviteUseCase {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private loggingService: LoggingService,
    private i18n: I18nService,
    private systemConfigurationService: SystemConfigurationService,
    private shortUrlService: ShortUrlService,
  ) {}

  async execute(dto: {
    email: string;
    roleId: string;
    createdById: string;
    name?: string | null;
    companyId?: string | null;
  }) {
    const health = await this.emailService.checkHealth();
    if (!health.operational) {
      throw new ServiceUnavailableException(
        this.i18n.t('auth.invite.email_service_unavailable'),
      );
    }

    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
      select: { id: true, name: true },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const email = dto.email.trim().toLowerCase();
    const companyId = dto.companyId ?? null;
    const payload: InviteTokenPayload = {
      email,
      role: role.name,
      roleId: dto.roleId,
      createdById: dto.createdById,
      createdAt: new Date().toISOString(),
      name: dto.name ?? null,
      companyId,
    };
    const token = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_INVITE_SECRET'),
      expiresIn: '2d',
    });

    await this.loggingService.create(
      {
        module: 'AUTH',
        action: LogActions.GENERATE_INVITE_TOKEN,
        message: `Token de convite gerado para ${email} (role: ${role.name})`,
        metadata: {
          email,
          roleId: dto.roleId,
          createdById: dto.createdById,
        },
      },
      dto.createdById,
    );

    const appUrl = process.env.NEXTAUTH_URL;
    const appName = await this.readConfigValue('SYSTEM_APP_NAME');
    const originalActionUrl = `${appUrl}/signup?inviteToken=${encodeURIComponent(token)}`;
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const inviteTokenHash = createHash('sha256').update(token).digest('hex');

    const shortLink = await this.shortUrlService.shorten({
      targetUrl: originalActionUrl,
      expiresAt,
      purpose: 'INVITE',
      createdById: dto.createdById,
    });
    const actionUrl = shortLink.shortUrl;

    const previousInvite = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        WITH lock AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(hashtextextended(${`invite:${email}`}, 0))
        )
        SELECT 1::int FROM lock
      `;
      const previous = await tx.invite.findFirst({
        where: { email, companyId },
        select: {
          id: true,
          roleId: true,
          createdById: true,
          expiresAt: true,
          actionUrl: true,
          tokenHash: true,
          usedAt: true,
          companyId: true,
        },
      });
      if (previous) {
        await tx.invite.update({
          where: { id: previous.id },
          data: {
            roleId: dto.roleId,
            createdById: dto.createdById,
            expiresAt,
            actionUrl: null,
            tokenHash: inviteTokenHash,
            usedAt: null,
          },
        });
      } else {
        await tx.invite.create({
          data: {
            email,
            roleId: dto.roleId,
            createdById: dto.createdById,
            expiresAt,
            actionUrl: null,
            tokenHash: inviteTokenHash,
            companyId,
          },
        });
      }
      return previous;
    });

    const templateData = {
      name: dto.name ?? email,
      organization: appName ?? '',
      message: `Você recebeu um convite para se juntar ao ${appName ?? 'sistema'}. Clique no botão abaixo para aceitar. O link expira em 48 horas.`,
      action_url: actionUrl,
    };

    try {
      const html = await this.emailService.renderTemplate(
        EmailTemplateType.INVITATION,
        templateData,
      );
      const sendResult = await this.emailService.sendNow({
        subject: 'Você foi convidado para se juntar ao sistema',
        to: email,
        html,
        performedById: dto.createdById,
      });

      if (!sendResult.status) {
        throw new InternalServerErrorException(
          this.i18n.t('auth.invite.email_send_failed'),
        );
      }
    } catch (error) {
      await this.shortUrlService.deactivate(shortLink.code).catch(() => {});
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          WITH lock AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtextextended(${`invite:${email}`}, 0))
          )
          SELECT 1::int FROM lock
        `;
        if (previousInvite) {
          const { id: _id, companyId: _cid, ...restoreData } = previousInvite;
          await tx.invite.updateMany({
            where: { email, tokenHash: inviteTokenHash },
            data: { ...restoreData, companyId: previousInvite.companyId },
          });
        } else {
          await tx.invite.deleteMany({
            where: { email, tokenHash: inviteTokenHash },
          });
        }
      });
      throw error;
    }

    return { actionUrl };
  }

  private async readConfigValue(labelKey: string): Promise<string | null> {
    try {
      const record =
        await this.systemConfigurationService.findByLabelKey(labelKey);
      return (record?.value as string) ?? null;
    } catch (err) {
      if (err instanceof NotFoundException) return null;
      throw err;
    }
  }

  /** Valida contra o convite vigente; claims assinadas não são fonte de role nem revogação. */
  async validateInviteToken(token: string): Promise<
    InviteTokenPayload & {
      userExists: boolean;
      inviteId: string;
      tokenHash: string;
    }
  > {
    let payload: unknown;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_INVITE_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(this.i18n.t('auth.invite.invalid_token'));
    }

    const invitePayload = payload as InviteTokenPayload;
    if (!invitePayload.email || typeof invitePayload.email !== 'string') {
      throw new UnauthorizedException(this.i18n.t('auth.invite.invalid_token'));
    }

    const currentInvite = await this.prisma.invite.findFirst({
      where: {
        email: invitePayload.email.trim().toLowerCase(),
        tokenHash: createHash('sha256').update(token).digest('hex'),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { role: { select: { id: true, name: true } } },
    });
    if (!currentInvite) {
      throw new UnauthorizedException(this.i18n.t('auth.invite.already_used'));
    }
    if (!currentInvite.tokenHash) {
      throw new UnauthorizedException(this.i18n.t('auth.invite.invalid_token'));
    }
    if (!currentInvite.createdById) {
      throw new UnauthorizedException(this.i18n.t('auth.invite.invalid_token'));
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: currentInvite.email },
    });

    if (existingUser) {
      const alreadyHasRole = existingUser.roleId === currentInvite.roleId;
      if (alreadyHasRole) {
        throw new ConflictException(this.i18n.t('auth.invite.already_member'));
      }
    }

    return {
      email: currentInvite.email,
      role: currentInvite.role.name,
      roleId: currentInvite.roleId,
      createdById: currentInvite.createdById,
      createdAt: invitePayload.createdAt,
      name: invitePayload.name ?? null,
      companyId: currentInvite.companyId ?? null,
      inviteId: currentInvite.id,
      tokenHash: currentInvite.tokenHash,
      userExists: existingUser !== null,
    };
  }

  async acceptInvite(
    dto: { token: string },
    currentUser: { id: string; email: string },
  ): Promise<{ created: 'user_updated' }> {
    const invitePayload = await this.validateInviteToken(dto.token);
    if (currentUser.email.trim().toLowerCase() !== invitePayload.email) {
      throw new ForbiddenException(this.i18n.t('auth.invite.email_mismatch'));
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const invite = await tx.invite.findFirst({
        where: {
          id: invitePayload.inviteId,
          email: invitePayload.email,
          tokenHash: invitePayload.tokenHash,
          usedAt: null,
          expiresAt: { gt: now },
        },
      });
      if (!invite) {
        throw new UnauthorizedException(
          this.i18n.t('auth.invite.invalid_token'),
        );
      }
      const user = await tx.user.findUnique({
        where: { id: currentUser.id },
        select: { id: true, email: true },
      });
      if (!user || user.email.trim().toLowerCase() !== invite.email) {
        throw new ForbiddenException(this.i18n.t('auth.invite.email_mismatch'));
      }
      const claimed = await tx.invite.updateMany({
        where: {
          id: invite.id,
          tokenHash: invite.tokenHash,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) {
        throw new UnauthorizedException(
          this.i18n.t('auth.invite.invalid_token'),
        );
      }
      await tx.user.update({
        where: { id: user.id },
        data: { roleId: invite.roleId },
      });
      if (invite.companyId) {
        const existingMembership = await tx.membership.findFirst({
          where: { userId: user.id, companyId: invite.companyId },
        });
        if (!existingMembership) {
          await tx.membership.create({
            data: {
              userId: user.id,
              companyId: invite.companyId,
            },
          });
        }
      }
    });

    return { created: 'user_updated' };
  }
}
