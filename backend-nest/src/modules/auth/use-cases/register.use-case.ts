import { Injectable, ConflictException } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';
import { EmailService } from '../../email/email.service';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { RegisterDto } from '../dto/register.dto';
import { LogActions } from 'src/domain/logging/log-actions';

type RegisterInput = Omit<RegisterDto, 'password'> & {
  password?: string;
  emailVerifiedAt?: Date;
};

@Injectable()
export class RegisterUseCase {
  constructor(
    private prisma: PrismaService,
    private cryptoService: CryptoService,
    private loggingService: LoggingService,
    private i18n: I18nService,
    private emailService: EmailService,
    private systemConfigurationService: SystemConfigurationService,
  ) {}

  async execute(dto: RegisterInput) {
    const user = await this.prisma.$transaction((tx) =>
      this.createInTransaction(tx, dto),
    );
    await this.logRegistration(user, dto.role || 'USER');
    return user;
  }

  async createInTransaction(
    tx: Prisma.TransactionClient,
    dto: RegisterInput,
  ): Promise<Omit<User, 'salt' | 'hash'>> {
    const existingUser = await tx.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException(
        this.i18n.t('auth.register.email_already_exists'),
      );
    }

    const credentials = dto.password
      ? await this.cryptoService.generatePasswordHash(dto.password)
      : { hash: null, salt: null };
    const roleName = dto.role || 'USER';

    const roleRecord = await tx.role.findUnique({
      where: { name: roleName },
      select: { id: true },
    });

    if (!roleRecord) throw new Error(`Role "${roleName}" não encontrada`);

    const roleRoutes = await tx.roleRouteAccess.findMany({
      where: { roleId: roleRecord.id },
      select: { routeId: true },
    });
    const newUser = await tx.user.create({
      data: {
        email: dto.email,
        emailVerifiedAt: dto.emailVerifiedAt ?? null,
        salt: credentials.salt,
        hash: credentials.hash,
        name: dto.name,
        roleId: roleRecord.id,
        termsAcceptedAt: dto.termsAcceptedAt ?? null,
        termsVersion: dto.termsVersion ?? null,
      },
    });

    if (roleRoutes.length > 0) {
      await tx.userRouteAccess.createMany({
        data: roleRoutes.map((rr) => ({
          userId: newUser.id,
          routeId: rr.routeId,
          grantedBy: newUser.id,
        })),
      });
    }

    const { salt: _salt, hash: _hash, ...result } = newUser;
    return result;
  }

  async logRegistration(
    user: Pick<User, 'id' | 'email'>,
    roleName: string,
  ): Promise<void> {
    await this.loggingService.create(
      {
        module: 'AUTH',
        action: LogActions.REGISTER,
        message: `Novo usuário ${user.email} registrado`,
        metadata: {
          userId: user.id,
          userEmail: user.email,
          roleName,
        },
      },
      user.id,
    );
  }
}
