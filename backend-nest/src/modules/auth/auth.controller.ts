import {
  Controller,
  Body,
  UseGuards,
  Res,
  Req,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { I18nService } from 'nestjs-i18n';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { ApiTags, ApiBody } from '@nestjs/swagger';
import { GetApi, PostApi } from 'src/common/decorators/api-method.decorator';
import type {
  AuthenticatedUser,
  UserPayload,
} from '../../common/types/auth.types';
import { UserService } from '../user/user.service';
import {
  GenerateCompanyInviteTokenDto,
  GenerateInviteTokenDto,
  ValidateInviteTokenDto,
} from './dto/generate-invite-token.dto';
import { ROLES } from 'src/types/userRole';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(
    private readonly authService: AuthService,
    private readonly i18n: I18nService,
    private readonly userService: UserService,
  ) {}

  @PostApi({
    path: 'validate-invite-token',
    summary: 'Valida o token de convite de usuário',
    description: 'Valida se o token de convite é válido e retorna o payload',
    status: 'OK',
    authenticated: false,
  })
  async validateInviteToken(@Body() dto: ValidateInviteTokenDto) {
    const token = dto.token;
    if (!token) {
      throw new UnauthorizedException(this.i18n.t('auth.invite.invalid_token'));
    }
    const payload = await this.authService.validateInviteToken(token);
    return { valid: true, token: token, email: payload?.email };
  }

  @PostApi({
    path: 'invite-token',
    summary: 'Gera token de convite para novo usuário',
    description:
      'Permite que um administrador gere um token para cadastro de novo usuário',
    status: 'CREATED',
    roles: ['ADMIN'],
    authenticated: true,
    body: GenerateInviteTokenDto,
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Token de convite gerado com sucesso',
        },
      ],
    },
  })
  async generateInviteToken(
    @Body() dto: GenerateInviteTokenDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return await this.authService.generateInviteToken({
      email: dto.email,
      role: dto.role,
      createdById: admin.id,
    });
  }

  @PostApi({
    path: 'invite-company-token',
    summary: 'Gera token de convite para novo usuário de uma empresa',
    description:
      'Permite que um administrador gere um token para cadastro de novo usuário',
    status: 'CREATED',
    roles: ['ADMIN'],
    authenticated: true,
    body: GenerateInviteTokenDto,
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Token de convite gerado com sucesso',
        },
      ],
    },
  })
  async generateCompanyInviteToken(
    @Body() dto: GenerateCompanyInviteTokenDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return await this.authService.generateCompanyInviteToken({
      email: dto.email,
      name: dto.name || null,
      companyId: dto.companyId,
      role: String(ROLES[1]),
      createdById: admin.id,
    });
  }

  @PostApi({
    path: 'register',
    summary: 'auth.register.title',
    description: 'auth.register.description',
    body: RegisterDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    return { user };
  }

  @UseGuards(LocalAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas por minuto
  @PostApi({
    path: 'login',
    summary: 'auth.login.title',
    body: LoginDto,
    status: 'OK',
  })
  @ApiBody({ type: LoginDto })
  async login(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tokens = await this.authService.login(user);

    // Define cookies HttpOnly no backend
    response.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 15 * 60 * 1000, // 15 minutos
    });

    response.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    });

    // Busca rotas permitidas do usuário
    const routes = await this.authService.getUserRoutes(user.id);

    // Retorna dados do usuário.
    // Em ambiente de desenvolvimento, também expõe os tokens na resposta
    // para facilitar testes no Swagger UI.
    const responseBody: {
      user: {
        id: string;
        email: string;
        role: AuthenticatedUser['role'];
        routes: Array<{
          id: string;
          path: string;
          labelKey: string;
          parentId: string | null;
        }>;
      };
      message: string;
      tokens?: { accessToken: string; refreshToken: string };
    } = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        routes,
      },
      message: this.i18n.t('auth.login.success'),
    };

    if (process.env.NODE_ENV !== 'production') {
      responseBody.tokens = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }

    return responseBody;
  }

  @PostApi({
    path: 'refresh',
    summary: 'auth.token.refresh_title',
    status: 'OK',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Lê refresh token do cookie
    const refreshToken = request.cookies?.refresh_token as string;

    if (!refreshToken) {
      throw new UnauthorizedException(
        this.i18n.t('auth.token.refresh_not_found'),
      );
    }

    // Valida refresh token no banco
    const user = await this.authService.validateRefreshToken(refreshToken);

    // Remove token antigo
    await this.authService.revokeRefreshToken(refreshToken);

    // Gera novos tokens
    const tokens = await this.authService.login({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Atualiza cookies com novos tokens
    response.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 15 * 60 * 1000, // 15 minutos
    });

    response.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    });

    return { message: this.i18n.t('auth.token.refresh_success') };
  }

  @PostApi({
    path: 'logout',
    summary: 'auth.logout.title',
    authenticated: true,
    status: 'OK',
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const refreshToken = request.cookies?.refresh_token as string;
    // Revoga refresh token do banco
    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken, currentUser.id);
    }

    // Remove cookies (com as mesmas opções usadas ao criar)
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
    };
    response.clearCookie('access_token', cookieOptions);
    response.clearCookie('refresh_token', cookieOptions);

    return { message: this.i18n.t('auth.logout.success') };
  }

  @GetApi({
    path: 'me',
    summary: 'auth.me.title',
    authenticated: true,
  })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    // Retorna dados do JWT + rotas permitidas
    const routes = await this.authService.getUserRoutes(user.id);
    if (user.role === 'USER') {
      for (const route of routes) {
        route.isHome = route.isClientHome ?? false;
        delete route?.isClientHome;
        // Adicione aqui outros campos que deseja remover para USER
      }
    }
    return {
      ...user,
      routes,
    };
  }

  @GetApi({
    path: 'user',
    summary: 'auth.me.title',
    authenticated: true,
  })
  async getUser(@CurrentUser() user: UserPayload) {
    // Retorna dados do JWT + rotas permitidas
    const userData = await this.userService.findOne(user.id);
    const routes = await this.authService.getUserRoutes(user.id);
    return {
      ...userData,
      routes,
    };
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 tentativas por minuto
  @PostApi({
    path: 'forgot-password',
    summary: 'auth.forgot_password.title',
    description: 'auth.forgot_password.description',
    body: ForgotPasswordDto,
    status: 'OK',
    authenticated: false,
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);

    // Sempre retorna sucesso (não revela se o email existe)
    return {
      message: this.i18n.t('auth.forgot_password.success'),
    };
  }

  @GetApi({
    path: 'check-reset-token',
    summary: 'Validates password reset token',
    description: 'Checks if a password reset token is valid and not expired',
    status: 'OK',
    authenticated: false,
  })
  async checkResetToken(@Req() request: Request) {
    const token = request.query.token as string;

    if (!token) {
      throw new UnauthorizedException(
        this.i18n.t('auth.password_reset.invalid_token'),
      );
    }

    const isValid = await this.authService.validateResetToken(token);

    if (!isValid) {
      throw new UnauthorizedException(
        this.i18n.t('auth.password_reset.invalid_token'),
      );
    }

    return { valid: true };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas por minuto
  @PostApi({
    path: 'reset-password',
    summary: 'auth.reset_password.title',
    description: 'auth.reset_password.description',
    body: ResetPasswordDto,
    status: 'OK',
    authenticated: false,
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);

    return {
      message: this.i18n.t('auth.reset_password.success'),
    };
  }
}
