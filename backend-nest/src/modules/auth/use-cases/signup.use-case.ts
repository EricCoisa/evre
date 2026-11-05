import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { LoggingService } from '../../logging/logging.service';
import { ShortUrlService } from '../../short-url/short-url.service';
import { EmailTemplateType } from '../../../domain/mail/email-template-type.const';
import { UserRoleConst } from '../../../domain/auth/userRole.const';
import { LogActions } from '../../../domain/logging/log-actions';
import { GenerateInviteUseCase } from './generate-invite.use-case';
import { RegisterUseCase } from './register.use-case';

const PASSWORD_SIGNUP_PURPOSE = 'PASSWORD';
const OAUTH_SIGNUP_PURPOSE = 'OAUTH';
const OAUTH_INVITE_PURPOSE = 'INVITE';
const SIGNUP_INTENT_TTL_MS = 30 * 60 * 1000;
const SIGNUP_RESEND_COOLDOWN_MS = 60 * 1000;

function tokenHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class SignupUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfigurationService: SystemConfigurationService,
    private readonly generateInviteUseCase: GenerateInviteUseCase,
    private readonly registerUseCase: RegisterUseCase,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly shortUrlService: ShortUrlService,
  ) {}

  async execute(dto: {
    email: string;
    password?: string;
    name?: string;
    inviteToken?: string;
    acceptTerms?: boolean;
  }) {
    if (dto.inviteToken) return this.acceptInvite(dto);
    return this.requestEmailConfirmation(dto);
  }

  async completeEmailSignup(dto: {
    token: string;
    password: string;
    acceptTerms: boolean;
  }) {
    if (!dto.password) {
      throw new BadRequestException(
        this.i18n.t('auth.validation.password_required'),
      );
    }
    this.requireAcceptedTerms(dto.acceptTerms);
    await this.assertSignupAvailable();
    const parsedToken = this.parseIntentToken(dto.token);
    const now = new Date();

    const intent = await this.prisma.signupIntent.findUnique({
      where: { id: parsedToken.id },
    });
    if (
      !intent ||
      intent.purpose !== PASSWORD_SIGNUP_PURPOSE ||
      intent.usedAt ||
      intent.expiresAt <= now ||
      intent.attempts >= intent.maxAttempts
    ) {
      throw this.invalidConfirmation();
    }

    if (!this.matchesToken(parsedToken.secret, intent.tokenHash)) {
      await this.prisma.signupIntent.updateMany({
        where: {
          id: intent.id,
          purpose: PASSWORD_SIGNUP_PURPOSE,
          usedAt: null,
          expiresAt: { gt: now },
          attempts: { lt: intent.maxAttempts },
        },
        data: { attempts: { increment: 1 } },
      });
      throw this.invalidConfirmation();
    }

    const termsVersion =
      (await this.systemConfigurationService.getValueOrNull(
        'SYSTEM_TERMS_VERSION',
      )) ?? '1.0';

    const user = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.signupIntent.updateMany({
        where: {
          id: intent.id,
          purpose: PASSWORD_SIGNUP_PURPOSE,
          tokenHash: intent.tokenHash,
          usedAt: null,
          expiresAt: { gt: now },
          attempts: { lt: intent.maxAttempts },
        },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw this.invalidConfirmation();

      return this.registerUseCase.createInTransaction(tx, {
        email: intent.email,
        name: intent.name ?? undefined,
        password: dto.password,
        role: 'USER',
        emailVerifiedAt: now,
        termsAcceptedAt: now,
        termsVersion: String(termsVersion),
      });
    });

    await this.registerUseCase.logRegistration(user, UserRoleConst.USER);
    return { accountCreated: true, user };
  }

  async isAutonomousSignupAvailable(): Promise<boolean> {
    const signupEnabled =
      await this.systemConfigurationService.getValueOrNull(
        'SYSTEM_USER_CREATE',
      );
    if (String(signupEnabled).toLowerCase() !== 'true') return false;
    return (await this.emailService.checkHealth()).operational;
  }

  async createProviderConsentIntent(input: {
    email: string;
    name?: string;
    providerId: string;
    callbackUrl?: string;
    inviteId?: string;
    inviteTokenHash?: string;
    userId?: string;
  }): Promise<string> {
    const isInvite = Boolean(input.inviteId);
    if (!isInvite) await this.assertSignupAvailable();

    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const token = `${id}.${secret}`;
    await this.prisma.signupIntent.create({
      data: {
        id,
        email: input.email.trim().toLowerCase(),
        name: input.name ?? null,
        purpose: isInvite ? OAUTH_INVITE_PURPOSE : OAUTH_SIGNUP_PURPOSE,
        tokenHash: tokenHash(secret),
        providerId: input.providerId,
        inviteId: input.inviteId ?? null,
        inviteTokenHash: input.inviteTokenHash ?? null,
        userId: input.userId ?? null,
        callbackUrl: input.callbackUrl ?? null,
        expiresAt: new Date(Date.now() + SIGNUP_INTENT_TTL_MS),
      },
    });
    return token;
  }

  async completeProviderConsent(dto: { token: string; acceptTerms: boolean }) {
    this.requireAcceptedTerms(dto.acceptTerms);
    const parsedToken = this.parseIntentToken(dto.token);
    const now = new Date();
    const intent = await this.prisma.signupIntent.findUnique({
      where: { id: parsedToken.id },
    });
    if (
      !intent ||
      ![OAUTH_SIGNUP_PURPOSE, OAUTH_INVITE_PURPOSE].includes(intent.purpose) ||
      intent.usedAt ||
      intent.expiresAt <= now ||
      intent.attempts >= intent.maxAttempts
    ) {
      throw this.invalidConfirmation();
    }
    if (!this.matchesToken(parsedToken.secret, intent.tokenHash)) {
      await this.prisma.signupIntent.updateMany({
        where: {
          id: intent.id,
          usedAt: null,
          expiresAt: { gt: now },
          attempts: { lt: intent.maxAttempts },
        },
        data: { attempts: { increment: 1 } },
      });
      throw this.invalidConfirmation();
    }

    if (intent.purpose === OAUTH_SIGNUP_PURPOSE) {
      await this.assertSignupAvailable();
    }
    if (!intent.providerId) throw this.invalidConfirmation();
    const termsVersion = String(
      (await this.systemConfigurationService.getValueOrNull(
        'SYSTEM_TERMS_VERSION',
      )) ?? '1.0',
    );

    const completion = await this.prisma.$transaction(async (tx) => {
      const claimedIntent = await tx.signupIntent.updateMany({
        where: {
          id: intent.id,
          tokenHash: intent.tokenHash,
          usedAt: null,
          expiresAt: { gt: now },
          attempts: { lt: intent.maxAttempts },
        },
        data: { usedAt: now },
      });
      if (claimedIntent.count !== 1) throw this.invalidConfirmation();

      if (intent.purpose === OAUTH_INVITE_PURPOSE) {
        if (!intent.inviteId || !intent.inviteTokenHash) {
          throw this.invalidConfirmation();
        }
        const invite = await tx.invite.findFirst({
          where: {
            id: intent.inviteId,
            email: intent.email,
            tokenHash: intent.inviteTokenHash,
            usedAt: null,
            expiresAt: { gt: now },
          },
          include: { role: { select: { name: true } } },
        });
        if (!invite) throw this.invalidConfirmation();

        if (intent.userId) {
          const existing = await tx.user.findUnique({
            where: { id: intent.userId },
            select: { id: true, email: true, deletedAt: true, status: true },
          });
          if (
            !existing ||
            existing.email !== intent.email ||
            existing.deletedAt ||
            existing.status !== 'ACTIVE'
          ) {
            throw this.invalidConfirmation();
          }
          const updated = await tx.user.update({
            where: { id: existing.id },
            data: { roleId: invite.roleId },
            select: { id: true, email: true, roleId: true },
          });
          const consumedInvite = await tx.invite.updateMany({
            where: {
              id: invite.id,
              tokenHash: intent.inviteTokenHash,
              usedAt: null,
              expiresAt: { gt: now },
            },
            data: { usedAt: now },
          });
          if (consumedInvite.count !== 1) throw this.invalidConfirmation();
          if (invite.companyId) {
            const hasMembership = await tx.membership.findFirst({
              where: { userId: existing.id, companyId: invite.companyId },
            });
            if (!hasMembership) {
              await tx.membership.create({
                data: {
                  userId: existing.id,
                  companyId: invite.companyId,
                },
              });
            }
          }
          return {
            user: updated,
            created: false,
            inviteRoleName: invite.role.name,
          };
        }

        const user = await this.registerUseCase.createInTransaction(tx, {
          email: intent.email,
          name: intent.name ?? undefined,
          role: invite.role.name as 'USER' | 'ADMIN' | 'MODERATOR',
          emailVerifiedAt: now,
          termsAcceptedAt: now,
          termsVersion,
        });
        const consumedInvite = await tx.invite.updateMany({
          where: { id: invite.id, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        if (consumedInvite.count !== 1) throw this.invalidConfirmation();
        if (invite.companyId) {
          await tx.membership.create({
            data: {
              userId: user.id,
              companyId: invite.companyId,
            },
          });
        }
        return {
          user,
          created: true,
          inviteRoleName: invite.role.name,
        };
      }

      const user = await this.registerUseCase.createInTransaction(tx, {
        email: intent.email,
        name: intent.name ?? undefined,
        role: 'USER',
        emailVerifiedAt: now,
        termsAcceptedAt: now,
        termsVersion,
      });
      return { user, created: true, inviteRoleName: null };
    });

    if (completion.created) {
      await this.registerUseCase.logRegistration(
        completion.user,
        completion.inviteRoleName ?? UserRoleConst.USER,
      );
    }
    if (completion.inviteRoleName) {
      await this.loggingService.create(
        {
          module: 'AUTH',
          action: LogActions.ACCEPT_INVITE,
          message: `Convite aceito via OAuth (role: ${completion.inviteRoleName})`,
          metadata: {
            userId: completion.user.id,
            roleName: completion.inviteRoleName,
          },
        },
        completion.user.id,
      );
    }

    return {
      user: completion.user,
      callbackUrl: intent.callbackUrl ?? undefined,
    };
  }

  private async requestEmailConfirmation(dto: {
    email: string;
    name?: string;
  }) {
    await this.assertSignupAvailable();

    const email = dto.email.trim().toLowerCase();
    const genericResult = { accountCreated: false, email };
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) return genericResult;

    const appUrl = this.configService.get<string>('NEXTAUTH_URL');
    if (!appUrl) {
      throw new InternalServerErrorException(
        this.i18n.t('auth.signup.email_send_failed'),
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SIGNUP_INTENT_TTL_MS);
    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const token = `${id}.${secret}`;
    const appName =
      (await this.systemConfigurationService.getValueOrNull(
        'SYSTEM_APP_NAME',
      )) ?? '';

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        WITH lock AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(hashtextextended(${email}, 0))
        )
        SELECT 1::int FROM lock
      `;

      const existing = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing) return false;

      const cooldownBoundary = new Date(Date.now() - SIGNUP_RESEND_COOLDOWN_MS);
      const recentIntent = await tx.signupIntent.findFirst({
        where: {
          email,
          purpose: PASSWORD_SIGNUP_PURPOSE,
          usedAt: null,
          createdAt: { gt: cooldownBoundary },
        },
        select: { id: true },
      });
      if (recentIntent) return false;

      await tx.signupIntent.updateMany({
        where: {
          email,
          purpose: PASSWORD_SIGNUP_PURPOSE,
          usedAt: null,
        },
        data: { usedAt: now },
      });

      await tx.signupIntent.create({
        data: {
          id,
          email,
          name: dto.name?.trim() || null,
          purpose: PASSWORD_SIGNUP_PURPOSE,
          tokenHash: tokenHash(secret),
          expiresAt,
        },
      });
      return true;
    });
    if (!created) return genericResult;

    const originalActionUrl = new URL('/signup', appUrl);
    originalActionUrl.searchParams.set('signupToken', token);
    const shortLink = await this.shortUrlService.shorten({
      targetUrl: originalActionUrl.toString(),
      expiresAt,
      purpose: 'SIGNUP',
    });

    const html = await this.emailService.renderTemplate(
      EmailTemplateType.SIGNUP_WELCOME,
      {
        name: dto.name?.trim() || email,
        organization: appName,
        message: this.i18n.t('auth.signup.confirmation_email_message'),
        action_url: shortLink.shortUrl,
      },
    );

    let sent: { status: boolean };
    try {
      sent = await this.emailService.send({
        to: email,
        subject: this.i18n.t('auth.signup.confirmation_email_subject'),
        html,
      });
    } catch (error) {
      await this.shortUrlService.deactivate(shortLink.code).catch(() => {});
      await this.prisma.signupIntent.updateMany({
        where: { id, usedAt: null },
        data: { usedAt: new Date() },
      });
      throw error;
    }

    if (!sent.status) {
      await this.shortUrlService.deactivate(shortLink.code).catch(() => {});
      await this.prisma.signupIntent.updateMany({
        where: { id, usedAt: null },
        data: { usedAt: new Date() },
      });
      throw new InternalServerErrorException(
        this.i18n.t('auth.signup.email_send_failed'),
      );
    }

    return genericResult;
  }

  private async acceptInvite(dto: {
    password?: string;
    name?: string;
    acceptTerms?: boolean;
    inviteToken?: string;
  }) {
    const password = this.requirePassword(dto.password);
    this.requireAcceptedTerms(dto.acceptTerms);
    const invitePayload = await this.generateInviteUseCase.validateInviteToken(
      dto.inviteToken!,
    );
    const termsVersion =
      (await this.systemConfigurationService.getValueOrNull(
        'SYSTEM_TERMS_VERSION',
      )) ?? '1.0';
    const now = new Date();

    const completion = await this.prisma.$transaction(async (tx) => {
      const invite = await tx.invite.findFirst({
        where: {
          id: invitePayload.inviteId,
          email: invitePayload.email,
          tokenHash: invitePayload.tokenHash,
          usedAt: null,
          expiresAt: { gt: now },
        },
        include: { role: { select: { name: true } } },
      });
      if (!invite) throw this.invalidConfirmation();

      const claimed = await tx.invite.updateMany({
        where: {
          id: invite.id,
          tokenHash: invitePayload.tokenHash,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw this.invalidConfirmation();

      const user = await this.registerUseCase.createInTransaction(tx, {
        email: invite.email,
        password,
        name: dto.name,
        role: invite.role.name as 'USER' | 'ADMIN' | 'MODERATOR',
        emailVerifiedAt: now,
        termsAcceptedAt: now,
        termsVersion: String(termsVersion),
      });
      if (invite.companyId) {
        await tx.membership.create({
          data: {
            userId: user.id,
            companyId: invite.companyId,
          },
        });
      }
      return { user, roleName: invite.role.name };
    });

    await this.registerUseCase.logRegistration(
      completion.user,
      completion.roleName,
    );
    return { accountCreated: true, user: completion.user };
  }

  private async assertSignupAvailable(): Promise<void> {
    const signupEnabled =
      await this.systemConfigurationService.getValueOrNull(
        'SYSTEM_USER_CREATE',
      );
    if (String(signupEnabled).toLowerCase() !== 'true') {
      throw new ForbiddenException(
        this.i18n.t('auth.login.invalid_credentials'),
      );
    }
    const health = await this.emailService.checkHealth();
    if (!health.operational) {
      throw new ServiceUnavailableException(
        this.i18n.t('auth.invite.email_service_unavailable'),
      );
    }
  }

  private parseIntentToken(token: string): { id: string; secret: string } {
    const [id, secret, extra] = token.split('.');
    if (!id || !secret || extra !== undefined) throw this.invalidConfirmation();
    return { id, secret };
  }

  private matchesToken(secret: string, expectedHash: string): boolean {
    const actual = Buffer.from(tokenHash(secret), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private requirePassword(password: string | undefined): string {
    if (!password) {
      throw new BadRequestException(this.i18n.t('auth.invite.signup_required'));
    }
    return password;
  }

  private requireAcceptedTerms(acceptTerms: boolean | undefined): void {
    if (acceptTerms !== true) {
      throw new BadRequestException(this.i18n.t('auth.signup.terms_required'));
    }
  }

  private invalidConfirmation(): UnauthorizedException {
    return new UnauthorizedException(
      this.i18n.t('auth.signup.invalid_confirmation'),
    );
  }
}
