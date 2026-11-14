import {
  Injectable,
  BadRequestException,
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
import { MessagingService } from '../../messaging/messaging.service';
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
    private messagingService: MessagingService,
  ) {}

  async execute(dto: {
    email?: string | null;
    phone?: string | null;
    channel?: 'EMAIL' | 'WHATSAPP';
    roleId: string;
    createdById: string;
    name?: string | null;
    companyId?: string | null;
  }) {
    const channel = dto.channel ?? 'EMAIL';

    if (channel === 'WHATSAPP') {
      if (!dto.phone?.trim()) {
        throw new BadRequestException(this.i18n.t('auth.invite.phone_required'));
      }
      if (!(await this.messagingService.isEnabled())) {
        throw new ServiceUnavailableException(
          this.i18n.t('auth.invite.whatsapp_service_unavailable'),
        );
      }
    } else {
      if (!dto.email?.trim()) {
        throw new BadRequestException(this.i18n.t('auth.invite.email_required'));
      }
      const health = await this.emailService.checkHealth();
      if (!health.operational) {
        throw new ServiceUnavailableException(
          this.i18n.t('auth.invite.email_service_unavailable'),
        );
      }
    }

    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
      select: { id: true, name: true },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const email = channel === 'EMAIL' ? dto.email!.trim().toLowerCase() : null;
    const phone = channel === 'WHATSAPP' ? dto.phone!.trim() : null;
    const companyId = dto.companyId ?? null;

    if (channel === 'WHATSAPP') {
      const existingByPhone = await this.prisma.user.findFirst({ where: { phone: phone! } });
      if (existingByPhone) {
        throw new ConflictException(this.i18n.t('auth.invite.phone_already_registered'));
      }
    }

    const payload: InviteTokenPayload = {
      email,
      phone,
      channel,
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
        message: `Token de convite gerado para ${channel === 'WHATSAPP' ? phone : email} (role: ${role.name})`,
        metadata: { email, phone, channel, roleId: dto.roleId, createdById: dto.createdById },
      },
      dto.createdById,
    );

    const appUrl = this.configService.get<string>('NEXTAUTH_URL');
    if (!appUrl) {
      throw new InternalServerErrorException(this.i18n.t('auth.signup.email_send_failed'));
    }
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

    const lockKey = channel === 'WHATSAPP' ? `invite:phone:${phone}` : `invite:${email}`;

    const previousInvite = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        WITH lock AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
        )
        SELECT 1::int FROM lock
      `;
      const previous = await tx.invite.findFirst({
        where: channel === 'WHATSAPP' ? { phone, companyId } : { email, companyId },
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
            name: dto.name ?? null,
          },
        });
      } else {
        await tx.invite.create({
          data: {
            email,
            phone,
            channel,
            name: dto.name ?? null,
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

    const rollbackInvite = async () => {
      await this.shortUrlService.deactivate(shortLink.code).catch(() => {});
      const whereByIdentity = channel === 'WHATSAPP'
        ? { phone, tokenHash: inviteTokenHash }
        : { email, tokenHash: inviteTokenHash };
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          WITH lock AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
          )
          SELECT 1::int FROM lock
        `;
        if (previousInvite) {
          const { id: _id, companyId: _cid, ...restoreData } = previousInvite;
          await tx.invite.updateMany({
            where: whereByIdentity,
            data: { ...restoreData, companyId: previousInvite.companyId },
          });
        } else {
          await tx.invite.deleteMany({ where: whereByIdentity });
        }
      });
    };

    try {
      if (channel === 'WHATSAPP') {
        const firstName = (dto.name ?? phone!).split(' ')[0];
        await this.messagingService.sendTemplateNow({
          key: 'INVITE',
          phone: phone!,
          reserved: { first_name: firstName },
          buttons: { open: shortLink.code },
        });
      } else {
        const templateData = {
          name: dto.name ?? email!,
          organization: appName ?? '',
          message: `Você recebeu um convite para se juntar ao ${appName ?? 'sistema'}. Clique no botão abaixo para aceitar. O link expira em 48 horas.`,
          action_url: actionUrl,
        };
        const html = await this.emailService.renderTemplate(
          EmailTemplateType.INVITATION,
          templateData,
        );
        const sendResult = await this.emailService.sendNow({
          subject: 'Você foi convidado para se juntar ao sistema',
          to: email!,
          html,
          performedById: dto.createdById,
        });
        if (!sendResult.status) {
          throw new InternalServerErrorException(
            this.i18n.t('auth.invite.email_send_failed'),
          );
        }
      }
    } catch (error) {
      await rollbackInvite();
      throw error;
    }

    await this.prisma.invite.updateMany({
      where: channel === 'WHATSAPP' ? { phone, tokenHash: inviteTokenHash } : { email, tokenHash: inviteTokenHash },
      data: { actionUrl },
    });

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
      companyName: string | null;
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
    const isWa = invitePayload.channel === 'WHATSAPP';

    if (!isWa && (!invitePayload.email || typeof invitePayload.email !== 'string')) {
      throw new UnauthorizedException(this.i18n.t('auth.invite.invalid_token'));
    }

    const tokenHashValue = createHash('sha256').update(token).digest('hex');
    const currentInvite = await this.prisma.invite.findFirst({
      where: {
        ...(isWa ? {} : { email: invitePayload.email!.trim().toLowerCase() }),
        tokenHash: tokenHashValue,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        role: { select: { id: true, name: true } },
        company: { select: { name: true } },
      },
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
    if (isWa && !currentInvite.phone) {
      throw new UnauthorizedException(this.i18n.t('auth.invite.invalid_token'));
    }

    const existingUser = isWa
      ? (currentInvite.phone
          ? await this.prisma.user.findFirst({ where: { phone: currentInvite.phone } })
          : null)
      : await this.prisma.user.findUnique({ where: { email: currentInvite.email! } });

    if (existingUser) {
      const alreadyHasRole = existingUser.roleId === currentInvite.roleId;
      if (alreadyHasRole && !currentInvite.companyId) {
        throw new ConflictException(this.i18n.t('auth.invite.already_member'));
      }
    }

    return {
      email: currentInvite.email,
      phone: currentInvite.phone ?? null,
      channel: (currentInvite.channel ?? 'EMAIL') as 'EMAIL' | 'WHATSAPP',
      role: currentInvite.role.name,
      roleId: currentInvite.roleId,
      createdById: currentInvite.createdById,
      createdAt: invitePayload.createdAt,
      name: invitePayload.name ?? null,
      companyId: currentInvite.companyId ?? null,
      companyName: currentInvite.company?.name ?? null,
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
    const isWa = invitePayload.channel === 'WHATSAPP';

    if (!isWa && currentUser.email.trim().toLowerCase() !== invitePayload.email) {
      throw new ForbiddenException(this.i18n.t('auth.invite.email_mismatch'));
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const invite = await tx.invite.findFirst({
        where: {
          id: invitePayload.inviteId,
          ...(isWa ? {} : { email: invitePayload.email }),
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
        select: { id: true, email: true, phone: true },
      });
      if (isWa) {
        if (!user || !invite.phone || user.phone !== invite.phone) {
          throw new ForbiddenException(this.i18n.t('auth.invite.phone_mismatch'));
        }
      } else if (!user || user.email.trim().toLowerCase() !== invite.email) {
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
