import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from '../../domain/auth/userRole.const';
import { UserStatusConst } from '../../domain/auth/userStatus.const';
import { UserPayload } from '../../common/types/auth.types';
import { I18nService } from 'nestjs-i18n';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/common/types/logging.types';
import { InviteTokenPayload } from 'src/domain/auth/tokenInvite.type';
import { EmailService } from '../email/email.service';
import { renderTemplateFromFile } from 'src/utils/email.util';
import { SystemConfigurationService } from '../system-configuration/system-configuration.service';
import * as path from 'path';

export type { UserPayload };

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private i18n: I18nService,
    private loggingService: LoggingService,
    private emailService: EmailService,
    private systemConfigurationService: SystemConfigurationService,
  ) {}

  /**
   * Valida credenciais do usuário com proteção contra timing attacks
   * Sempre faz hash mesmo quando usuário não existe
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<UserPayload | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Proteção contra timing attacks: sempre faz hash mesmo se usuário não existir
    // Usa um hash fake para manter tempo de resposta constante
    const passwordToCompare =
      user?.password || '$2b$10$fakeHashToPreventTimingAttack1234567890';
    const isPasswordValid = await bcrypt.compare(password, passwordToCompare);

    // Retorna null se usuário não existe OU senha inválida
    if (!user || !isPasswordValid) {
      return null;
    }

    // Verifica o status do usuário
    if (user.status === UserStatusConst.INACTIVE) {
      // Usuário inativo - retorna null como se não existisse
      return null;
    }

    if (user.status === UserStatusConst.SUSPENDED) {
      // Usuário suspenso - lança exceção específica
      throw new ForbiddenException(this.i18n.t('auth.login.user_suspended'));
    }

    // Apenas usuários ACTIVE podem fazer login
    if (user.status !== UserStatusConst.ACTIVE) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pwd, ...result } = user;
    return result;
  }

  async login(user: { id: string; email: string; role: UserRole }) {
    // Busca companyId do usuário
    const userData = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { companyId: true },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: userData?.companyId || null,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    // Salva refresh token no banco de dados
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'AUTH',
        action: LogActions.LOGIN,
        message: `Usuário ${user.email} efetuou login`,
        metadata: {
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
        },
      },
      user.id,
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  async register(dto: RegisterDto & { companyId?: string }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException(
        this.i18n.t('auth.register.email_already_exists'),
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const role = dto.role || 'USER';

    // Busca as rotas do role
    const roleRoutes = await this.prisma.roleRouteAccess.findMany({
      where: { roleId: role },
      select: { routeId: true },
    });

    // Cria o usuário e os acessos em uma transação
    const user = await this.prisma.$transaction(async (tx) => {
      // Cria o usuário
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          name: dto.name,
          role,
          companyId: dto.companyId || null, // Associa à empresa se fornecido
        },
      });

      // Cria os acessos do usuário baseado nas rotas do role
      if (roleRoutes.length > 0) {
        await tx.userRouteAccess.createMany({
          data: roleRoutes.map((rr) => ({
            userId: newUser.id,
            routeId: rr.routeId,
            grantedBy: newUser.id, // Auto-concedido no registro
          })),
        });
      }

      return newUser;
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'AUTH',
        action: LogActions.REGISTER,
        message: `Novo usuário ${user.email} registrado`,
        metadata: {
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
        },
      },
      user.id,
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pwd, ...result } = user;
    return result;
  }

  async refreshToken(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.login.user_not_found'));
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    return {
      accessToken,
    };
  }

  /**
   * Valida refresh token do banco de dados
   * Usado quando o refresh token vem do cookie (não do JWT payload)
   */
  async validateRefreshToken(token: string) {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException(this.i18n.t('auth.token.invalid'));
    }

    if (tokenRecord.expiresAt < new Date()) {
      // Remove token expirado
      await this.prisma.refreshToken.delete({
        where: { id: tokenRecord.id },
      });
      throw new UnauthorizedException(this.i18n.t('auth.token.expired'));
    }

    // Verifica se o usuário está ativo
    if (tokenRecord.user.status !== UserStatusConst.ACTIVE) {
      // Remove o refresh token
      await this.prisma.refreshToken.delete({
        where: { id: tokenRecord.id },
      });
      throw new UnauthorizedException(
        this.i18n.t('auth.login.user_not_active'),
      );
    }

    return tokenRecord.user;
  }

  /**
   * Remove refresh token do banco (logout)
   */
  async revokeRefreshToken(token: string, performedById?: string) {
    // Busca o token antes de remover para obter userId
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    const result = await this.prisma.refreshToken.deleteMany({
      where: { token },
    });

    // Log da ação se token foi encontrado
    if (tokenRecord && result.count > 0) {
      await this.loggingService.create(
        {
          module: 'AUTH',
          action: LogActions.LOGOUT,
          message: `Usuário ${tokenRecord.user.email} efetuou logout`,
          metadata: {
            userId: tokenRecord.user.id,
            userEmail: tokenRecord.user.email,
          },
        },
        performedById || tokenRecord.user.id,
      );
    }

    return result.count;
  }

  /**
   * Remove todos os refresh tokens de um usuário
   */
  async revokeAllUserTokens(userId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  /**
   * Busca rotas permitidas para o usuário
   * Combina rotas do role + rotas específicas do usuário
   */
  async getUserRoutes(
    userId: string,
    // userRole: UserRole,
  ): Promise<
    Array<{
      id: string;
      path: string;
      labelKey: string;
      icon?: string | null;
      parentId: string | null;
      ordem: number;
      isHome: boolean;
      isActive: boolean;
    }>
  > {
    // // Busca rotas pelo role
    // const roleRoutes = await this.prisma.roleRouteAccess.findMany({
    //   where: { roleId: userRole },
    //   include: {
    //     route: true,
    //   },
    // });

    // Busca rotas específicas do usuário
    const userRoutes = await this.prisma.userRouteAccess.findMany({
      where: { userId },
      include: {
        route: true,
      },
    });

    // Combina e remove duplicatas, filtrando apenas rotas ativas
    const routeMap = new Map<
      string,
      {
        id: string;
        path: string;
        labelKey: string;
        icon?: string | null;
        parentId: string | null;
        ordem: number;
        isHome: boolean;
        isActive: boolean;
      }
    >();

    // roleRoutes.forEach((rr) => {
    //   if (rr.route && rr.route.isActive) {
    //     routeMap.set(rr.route.id, {
    //       id: rr.route.id,
    //       path: rr.route.path,
    //       labelKey: rr.route.labelKey,
    //       icon: rr.route.icon,
    //       parentId: rr.route.parentId,
    //     });
    //   }
    // });

    userRoutes.forEach((ur) => {
      if (ur.route && ur.route.isActive) {
        routeMap.set(ur.route.id, {
          id: ur.route.id,
          path: ur.route.path,
          labelKey: ur.route.labelKey,
          icon: ur.route.icon,
          parentId: ur.route.parentId,
          ordem: ur.route.ordem,
          isHome: ur.route.isHome,
          isActive: ur.route.isActive,
        });
      }
    });

    return Array.from(routeMap.values());
  }

  /**
   * Gera um token de convite JWT para novo usuário
   */
  async generateInviteToken(dto: {
    email: string;
    role: string;
    createdById: string;
  }) {
    // Não permite gerar token se o email já existir
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException(
        this.i18n.t('auth.invite.email_already_exists'),
      );
    }

    const payload = {
      email: dto.email,
      role: dto.role,
      createdById: dto.createdById,
      createdAt: new Date().toISOString(),
    };
    // Expira em 2 dias
    const expiresIn = '2d';
    const token = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn,
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'AUTH',
        action: LogActions.GENERATE_INVITE_TOKEN,
        message: `Token de convite gerado para ${dto.email || 'novo usuário'} (role: ${dto.role})`,
        metadata: {
          email: dto.email,
          role: dto.role,
          createdById: dto.createdById,
        },
      },
      dto.createdById,
    );

    const appUrl = process.env.FRONTEND_URL;
    const appName = (
      await this.systemConfigurationService.findByLabelKey('SYSTEM_APP_NAME')
    ).value;
    const actionUrl = `${appUrl}/signup?inviteToken=${encodeURIComponent(token)}`;

    const templateData = {
      name: dto.email,
      organization: appName,
      message: `Você recebeu um convite para se juntar ao ${appName as string}. Clique no botão abaixo para aceitar. O link expira em 48 horas.`,
      action_url: actionUrl,
    };

    const templatePath = path.join(
      __dirname,
      '..',
      'email',
      'template',
      'invitation.html',
    );
    const html = await renderTemplateFromFile(templatePath, templateData, {
      escapeHtml: false,
    });

    await this.emailService.send({
      subject: 'Você foi convidado para se juntar ao sistema',
      to: dto.email,
      html,
    });

    return { actionUrl };
  }

  /**
   * Gera um token de convite JWT para novo usuário
   */
  async generateCompanyInviteToken(dto: {
    companyId: string;
    name: string | null;
    email: string;
    role: string;
    createdById: string;
  }) {
    // Não permite gerar token se o email já existir
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException(
        this.i18n.t('auth.invite.email_already_exists'),
      );
    }

    const payload = {
      companyId: dto.companyId,
      email: dto.email,
      role: dto.role,
      createdById: dto.createdById,
      createdAt: new Date().toISOString(),
    };
    // Expira em 2 dias
    const expiresIn = '2d';
    const token = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn,
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'AUTH',
        action: LogActions.GENERATE_INVITE_TOKEN,
        message: `Token de convite gerado para ${dto.email || 'novo usuário'} (role: ${dto.role}) (empresa: ${dto.companyId})`,
        metadata: {
          email: dto.email,
          role: dto.role,
          createdById: dto.createdById,
        },
      },
      dto.createdById,
    );

    const appUrl = process.env.FRONTEND_URL;
    const appName = (
      await this.systemConfigurationService.findByLabelKey('SYSTEM_APP_NAME')
    ).value;
    const actionUrl = `${appUrl}/signup?inviteToken=${encodeURIComponent(token)}`;

    const templateData = {
      name: dto.name || dto.email,
      email: dto.email,
      organization: appName,
      message: `Você recebeu um convite para se juntar ao ${appName as string}. Clique no botão abaixo para aceitar. O link expira em 48 horas.`,
      action_url: actionUrl,
    };

    const templatePath = path.join(
      __dirname,
      '..',
      'email',
      'template',
      'companyInvitation.html',
    );
    const html = await renderTemplateFromFile(templatePath, templateData, {
      escapeHtml: false,
    });

    const result = await this.emailService.send({
      subject: 'Você foi convidado para se juntar ao sistema',
      to: dto.email,
      html,
    });

    if (!result.status) {
      throw new BadRequestException('Falha ao enviar email de convite');
    }

    return { actionUrl };
  }

  async validateInviteToken(token: string): Promise<InviteTokenPayload> {
    let payload: unknown;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(this.i18n.t('auth.invite.invalid_token'));
    }

    const invitePayload = payload as InviteTokenPayload;

    // Verifica se o usuário já existe
    const user = await this.prisma.user.findUnique({
      where: { email: invitePayload.email },
    });
    if (user) {
      throw new ConflictException(
        this.i18n.t('auth.invite.email_already_exists'),
      );
    }

    return invitePayload;
  }

  /**
   * Solicita recuperação de senha via email
   * Nunca revela se o email existe ou não (proteção contra enumeração)
   */
  async requestPasswordReset(email: string): Promise<void> {
    // Normaliza o email
    const normalizedEmail = email.toLowerCase().trim();

    // Busca usuário pelo email
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Se o usuário não existir, retorna sem erro (não revela informação)
    if (!user) {
      // Log de tentativa com email inexistente
      await this.loggingService.create(
        {
          module: 'AUTH',
          action: LogActions.PASSWORD_RESET_REQUEST,
          message: `Tentativa de recuperação de senha para email não cadastrado: ${normalizedEmail}`,
          metadata: { email: normalizedEmail, userFound: false },
        },
        null,
      );
      return;
    }

    // Invalida tokens anteriores não utilizados deste usuário
    await this.prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    });

    // Gera token criptograficamente seguro (32 bytes = 64 caracteres hex)
    const token = crypto.randomBytes(32).toString('hex');

    // Cria hash SHA-256 do token para armazenar no banco
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Define expiração curta (30 minutos)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    // Persiste apenas o hash do token
    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    // Envia email com o token original
    const appUrl = process.env.FRONTEND_URL;
    const appName = (
      await this.systemConfigurationService.findByLabelKey('SYSTEM_APP_NAME')
    ).value;
    const actionUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

    const templateData = {
      name: user.name || user.email,
      organization: appName,
      message: `Você solicitou a recuperação de sua senha. Clique no botão abaixo para criar uma nova senha. O link expira em 30 minutos.`,
      action_url: actionUrl,
    };

    const templatePath = path.join(
      __dirname,
      '..',
      'email',
      'template',
      'password-reset.html',
    );
    const html = await renderTemplateFromFile(templatePath, templateData, {
      escapeHtml: false,
    });

    await this.emailService.send({
      subject: 'Recuperação de senha',
      to: user.email,
      html,
    });

    // Log de segurança
    await this.loggingService.create(
      {
        module: 'AUTH',
        action: LogActions.PASSWORD_RESET_REQUEST,
        message: `Solicitação de recuperação de senha para ${user.email}`,
        metadata: {
          userId: user.id,
          email: user.email,
          expiresAt: expiresAt.toISOString(),
        },
      },
      user.id,
    );
  }

  /**
   * Valida se o token de reset de senha é válido
   * Verifica se existe, não expirou e não foi usado
   */
  async validateResetToken(token: string): Promise<boolean> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const passwordResetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gte: new Date() },
        usedAt: null,
      },
    });

    return !!passwordResetToken;
  }

  /**
   * Redefine a senha do usuário usando token válido
   * Token de uso único, com expiração e hash
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Cria hash do token recebido
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Busca token válido (existe, não expirou, não foi usado)
    const passwordResetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gte: new Date() },
        usedAt: null,
      },
      include: {
        user: true,
      },
    });

    // Token inválido, expirado ou já usado - erro genérico (não revela causa)
    if (!passwordResetToken) {
      throw new BadRequestException(
        this.i18n.t('auth.password_reset.invalid_token'),
      );
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Atualiza senha e marca token como usado em transação
    await this.prisma.$transaction([
      // Atualiza senha do usuário
      this.prisma.user.update({
        where: { id: passwordResetToken.userId },
        data: { password: hashedPassword },
      }),
      // Marca token como usado
      this.prisma.passwordResetToken.update({
        where: { id: passwordResetToken.id },
        data: { usedAt: new Date() },
      }),
      // Invalida todos os refresh tokens ativos do usuário
      this.prisma.refreshToken.deleteMany({
        where: { userId: passwordResetToken.userId },
      }),
    ]);

    // Log de segurança
    await this.loggingService.create(
      {
        module: 'AUTH',
        action: LogActions.PASSWORD_RESET_COMPLETE,
        message: `Senha redefinida com sucesso para ${passwordResetToken.user.email}`,
        metadata: {
          userId: passwordResetToken.user.id,
          email: passwordResetToken.user.email,
        },
      },
      passwordResetToken.userId,
    );
  }
}
