import {
  Controller,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  Req,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { I18nService } from 'nestjs-i18n';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { ApiTags, ApiBody } from '@nestjs/swagger';
import {
  DeleteApi,
  GetApi,
  PostApi,
  PutApi,
} from 'src/common/decorators/api-method.decorator';
import type {
  AuthenticatedUser,
  UserPayload,
} from '../../common/types/auth.types';
import { extractRequestSource } from '../../common/utils/request-source.util';
import { FindOneUserUseCase } from '../user/use-cases/find-one-user.use-case';
import { LoginUseCase } from './use-cases/login.use-case';
import { RegisterUseCase } from './use-cases/register.use-case';
import { RefreshTokenUseCase } from './use-cases/refresh-token.use-case';
import { LogoutUseCase } from './use-cases/logout.use-case';
import { RequestPasswordResetUseCase } from './use-cases/request-password-reset.use-case';
import { ResetPasswordUseCase } from './use-cases/reset-password.use-case';
import { GenerateInviteUseCase } from './use-cases/generate-invite.use-case';
import { GetUserRoutesUseCase } from './use-cases/get-user-routes.use-case';
import { OauthProvidersUseCase } from './use-cases/oauth-providers.use-case';
import { OauthAuthorizeUrlUseCase } from './use-cases/oauth-authorize-url.use-case';
import { OauthCallbackUseCase } from './use-cases/oauth-callback.use-case';
import { SaveOauthConfigUseCase } from './use-cases/save-oauth-config.use-case';
import { CheckForgotPasswordStatusUseCase } from './use-cases/check-forgot-password-status.use-case';
import {
  GenerateInviteTokenDto,
  ValidateInviteTokenDto,
  AcceptInviteDto,
} from './dto/generate-invite-token.dto';
import { GetInvitesUseCase } from './use-cases/get-invites.use-case';
import { DeleteInviteUseCase } from './use-cases/delete-invite.use-case';
import {
  InviteTokenResponseDto,
  LoginResponseDto,
  MeResponseDto,
  MessageResponseDto,
  RegisterResponseDto,
  UserProfileResponseDto,
  ValidateInviteResponseDto,
  ValidTokenResponseDto,
  ForgotPasswordStatusResponseDto,
} from './dto/auth-response.dto';
import {
  OauthAuthorizeUrlDto,
  OauthAuthorizeRequestDto,
  OauthCallbackDto,
  OauthCallbackResponseDto,
  OauthCompleteSignupDto,
  OauthProviderDto,
  SaveOauthConfigDto,
} from './dto/oauth.dto';
import {
  FeatureFlagGuard,
  RequireFeature,
} from '../feature-flag/feature-flag.guard';
import { OAUTH_FEATURE_FLAG } from '../../domain/auth/oauthProvider.const';
import { CaptchaGuard, RequireCaptcha } from '../captcha/captcha.guard';
import { jwtExp } from '../../common/utils/jwt-exp.util';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
};

/** maxAge sai do `exp` do próprio JWT: cookie e token morrem juntos, e nenhuma
 *  constante local sai de sincronia com JWT_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN. */
const cookieMaxAge = (token: string, graceMs = 0) =>
  jwtExp(token) * 1000 - Date.now() + graceMs;

/** O cookie do refresh sobrevive de propósito ao token que carrega. */
const REFRESH_COOKIE_GRACE_MS = 24 * 60 * 60 * 1000;

function setAuthCookies(
  response: Response,
  tokens: { accessToken: string; refreshToken: string },
) {
  response.cookie('access_token', tokens.accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: cookieMaxAge(tokens.accessToken),
  });
  response.cookie('refresh_token', tokens.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: cookieMaxAge(tokens.refreshToken, REFRESH_COOKIE_GRACE_MS),
  });
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(
    private readonly i18n: I18nService,
    private readonly findOneUser: FindOneUserUseCase,
    private readonly getInvites$: GetInvitesUseCase,
    private readonly deleteInvite$: DeleteInviteUseCase,
    private readonly login$: LoginUseCase,
    private readonly register$: RegisterUseCase,
    private readonly refreshToken$: RefreshTokenUseCase,
    private readonly logout$: LogoutUseCase,
    private readonly requestPasswordReset$: RequestPasswordResetUseCase,
    private readonly resetPassword$: ResetPasswordUseCase,
    private readonly generateInvite$: GenerateInviteUseCase,
    private readonly getUserRoutes$: GetUserRoutesUseCase,
    private readonly oauthProviders$: OauthProvidersUseCase,
    private readonly oauthAuthorizeUrl$: OauthAuthorizeUrlUseCase,
    private readonly oauthCallback$: OauthCallbackUseCase,
    private readonly saveOauthConfig$: SaveOauthConfigUseCase,
    private readonly checkForgotPasswordStatus$: CheckForgotPasswordStatusUseCase,
  ) {}

  // Token de convite é segredo verificável: sem limite próprio, dava para varrer.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @PostApi({
    path: 'validate-invite-token',
    summary: 'Valida o token de convite de usuário',
    description: 'Valida se o token de convite é válido e retorna o payload',
    status: 'OK',
    authenticated: false,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Token válido',
          schema: { dto: ValidateInviteResponseDto },
        },
      ],
    },
  })
  async validateInviteToken(@Body() dto: ValidateInviteTokenDto) {
    const token = dto.token;
    if (!token) {
      throw new UnauthorizedException(this.i18n.t('auth.invite.invalid_token'));
    }
    const payload = await this.generateInvite$.validateInviteToken(token);
    return {
      valid: true,
      token: token,
      email: payload?.email,
      userExists: payload.userExists,
      // Nome eventualmente informado pelo administrador ao emitir o convite.
      name: payload?.name ?? undefined,
    };
  }

  @PostApi({
    path: 'invite-token',
    summary: 'Gera token de convite para usuário',
    description: 'Permite que um ADMIN gere um token de convite',
    status: 'CREATED',
    roles: ['ADMIN'],
    authenticated: true,
    body: GenerateInviteTokenDto,
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Token de convite gerado com sucesso',
          schema: { dto: InviteTokenResponseDto },
        },
      ],
    },
  })
  async generateInviteToken(
    @Body() dto: GenerateInviteTokenDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return await this.generateInvite$.execute({
      email: dto.email,
      roleId: dto.roleId,
      createdById: admin.id,
    });
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(CaptchaGuard)
  @RequireCaptcha()
  @PostApi({
    path: 'accept-invite',
    summary: 'Aceita convite',
    description:
      'Permite que uma conta autenticada com o e-mail convidado aceite o convite.',
    status: 'OK',
    authenticated: true,
    response: {
      success: [{ status: 'OK', description: 'Convite aceito com sucesso' }],
    },
  })
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.generateInvite$.acceptInvite(dto, currentUser);
    const { accessToken } = await this.refreshToken$.execute(currentUser.id);
    response.cookie('access_token', accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: cookieMaxAge(accessToken),
    });
    return result;
  }

  @PostApi({
    path: 'register',
    summary: 'auth.register.title',
    description: 'auth.register.description',
    body: RegisterDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Usuário registrado com sucesso',
          schema: { dto: RegisterResponseDto },
        },
      ],
    },
  })
  async register(@Body() dto: RegisterDto) {
    const user = await this.register$.execute(dto);
    return { user };
  }

  // Ordem importa: CaptchaGuard antes do LocalAuthGuard para que bot nenhum chegue
  // a queimar bcrypt nem a contar tentativa contra o lockout de uma conta alheia.
  @UseGuards(CaptchaGuard, LocalAuthGuard)
  @RequireCaptcha()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas por minuto
  @PostApi({
    path: 'login',
    summary: 'auth.login.title',
    body: LoginDto,
    status: 'OK',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Login realizado com sucesso',
          schema: { dto: LoginResponseDto },
        },
      ],
    },
  })
  @ApiBody({ type: LoginDto })
  async login(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tokens = await this.login$.execute(
      user,
      extractRequestSource(request),
    );

    setAuthCookies(response, tokens);

    const routes = await this.getUserRoutes$.execute(
      user.id,
      user.roleId,
      user.roleName,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.roleName,
        routes,
      },
      message: this.i18n.t('auth.login.success'),
    };
  }

  @PostApi({
    path: 'refresh',
    summary: 'auth.token.refresh_title',
    status: 'OK',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Token renovado com sucesso',
          schema: { dto: MessageResponseDto },
        },
      ],
    },
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.refresh_token as string;

    if (!refreshToken) {
      throw new UnauthorizedException(
        this.i18n.t('auth.token.refresh_not_found'),
      );
    }

    const tokens = await this.refreshToken$.rotate(
      refreshToken,
      extractRequestSource(request),
    );

    setAuthCookies(response, tokens);

    return { message: this.i18n.t('auth.token.refresh_success') };
  }

  @PostApi({
    path: 'logout',
    summary: 'auth.logout.title',
    authenticated: true,
    status: 'OK',
    response: {
      success: [
        {
          status: 'OK',
          description: 'Logout realizado com sucesso',
          schema: { dto: MessageResponseDto },
        },
      ],
    },
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const refreshToken = request.cookies?.refresh_token as string;
    if (refreshToken) {
      await this.logout$.execute(refreshToken, currentUser.id);
    }

    response.clearCookie('access_token', COOKIE_OPTIONS);
    response.clearCookie('refresh_token', COOKIE_OPTIONS);

    return { message: this.i18n.t('auth.logout.success') };
  }

  @GetApi({
    path: 'me',
    summary: 'auth.me.title',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Dados do usuário autenticado',
          schema: { dto: MeResponseDto },
        },
      ],
    },
  })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const routes = await this.getUserRoutes$.execute(
      user.id,
      user.roleId,
      user.roleName,
    );
    return { ...user, routes };
  }

  @GetApi({
    path: 'user',
    summary: 'auth.me.title',
    authenticated: true,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Dados completos do usuário autenticado',
          schema: { dto: UserProfileResponseDto },
        },
      ],
    },
  })
  async getUser(@CurrentUser() user: UserPayload) {
    const userData = await this.findOneUser.execute(user.id);
    const routes = await this.getUserRoutes$.execute(
      user.id,
      user.roleId,
      user.roleName,
    );
    return {
      ...userData,
      routes,
    };
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @GetApi({
    path: 'forgot-password/status',
    summary: 'Disponibilidade da recuperação de senha',
    description:
      'Informa se o serviço de envio de email está operacional para permitir a recuperação de senha',
    status: 'OK',
    authenticated: false,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Status de disponibilidade',
          schema: { dto: ForgotPasswordStatusResponseDto },
        },
      ],
    },
  })
  async forgotPasswordStatus(): Promise<ForgotPasswordStatusResponseDto> {
    return this.checkForgotPasswordStatus$.execute();
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(CaptchaGuard)
  @RequireCaptcha()
  @PostApi({
    path: 'forgot-password',
    summary: 'auth.forgot_password.title',
    description: 'auth.forgot_password.description',
    body: ForgotPasswordDto,
    status: 'OK',
    authenticated: false,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Email de recuperação enviado',
          schema: { dto: MessageResponseDto },
        },
      ],
    },
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.requestPasswordReset$.execute(dto.email);
    return { message: this.i18n.t('auth.forgot_password.success') };
  }

  // Mesma razão do validate-invite-token: valida segredo, então precisa de teto.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @GetApi({
    path: 'check-reset-token',
    summary: 'Validates password reset token',
    description: 'Checks if a password reset token is valid and not expired',
    status: 'OK',
    authenticated: false,
    queries: [
      {
        name: 'token',
        required: true,
        type: String,
        description: 'Token de reset recebido por email',
      },
    ],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Token válido',
          schema: { dto: ValidTokenResponseDto },
        },
      ],
    },
  })
  async checkResetToken(@Query('token') token?: string) {
    if (!token) {
      throw new UnauthorizedException(
        this.i18n.t('auth.password_reset.invalid_token'),
      );
    }

    const isValid = await this.resetPassword$.validateResetToken(token);

    if (!isValid) {
      throw new UnauthorizedException(
        this.i18n.t('auth.password_reset.invalid_token'),
      );
    }

    return { valid: true };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(CaptchaGuard)
  @RequireCaptcha()
  @PostApi({
    path: 'reset-password',
    summary: 'auth.reset_password.title',
    description: 'auth.reset_password.description',
    body: ResetPasswordDto,
    status: 'OK',
    authenticated: false,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Senha redefinida com sucesso',
          schema: { dto: MessageResponseDto },
        },
      ],
    },
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.resetPassword$.execute(dto.token, dto.password);
    return { message: this.i18n.t('auth.reset_password.success') };
  }

  @GetApi({
    path: 'invites',
    summary: 'Lista convites',
    description: 'Retorna todos os convites criados',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async getInvites() {
    return this.getInvites$.execute();
  }

  @DeleteApi({
    path: 'invites/:id',
    status: 'NO_CONTENT',
    summary: 'Remove um convite',
    description: 'Exclui um convite pelo id',
    authenticated: true,
    roles: ['ADMIN'],
  })
  async deleteInvite(@Param('id') id: string) {
    await this.deleteInvite$.execute(id);
  }

  // Rotas OAuth/OIDC, anônimas e gateadas por @RequireFeature('OAUTH_LOGIN'), que avalia com roleName vazio.

  @UseGuards(FeatureFlagGuard)
  @RequireFeature(OAUTH_FEATURE_FLAG)
  @GetApi({
    path: 'oauth/providers',
    summary: 'Lista providers OAuth registrados',
    description:
      'Fonte única da lista de providers. Cada item traz `configured`: o login desenha só os true, a administração desenha todos. 404 quando a feature está desligada.',
    status: 'OK',
    authenticated: false,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Providers disponíveis',
          schema: { dto: OauthProviderDto, isArray: true },
        },
      ],
    },
  })
  async oauthProviders() {
    return this.oauthProviders$.list();
  }

  /** Credenciais de um provider, validadas antes de gravar (OIDC Discovery no issuer). */
  @PutApi({
    path: 'oauth/:provider/config',
    summary: 'Valida e salva as credenciais de um provider OAuth',
    status: 'OK',
    roles: ['ADMIN'],
    body: SaveOauthConfigDto,
  })
  async saveOauthConfig(
    @Param('provider') provider: string,
    @Body() dto: SaveOauthConfigDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.saveOauthConfig$.execute(provider, dto, currentUser.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(FeatureFlagGuard, CaptchaGuard)
  @RequireFeature(OAUTH_FEATURE_FLAG)
  @RequireCaptcha()
  @PostApi({
    path: 'oauth/:provider/authorize-url',
    summary: 'Monta a URL de autorização do provider',
    description: 'Inicia um fluxo OAuth/OIDC protegido por CAPTCHA.',
    status: 'OK',
    authenticated: false,
    body: OauthAuthorizeRequestDto,
    response: {
      success: [
        {
          status: 'OK',
          description: 'URL de autorização',
          schema: { dto: OauthAuthorizeUrlDto },
        },
      ],
    },
  })
  async oauthAuthorizeUrl(
    @Param('provider') provider: string,
    @Body() dto: OauthAuthorizeRequestDto,
  ) {
    return this.oauthAuthorizeUrl$.execute(
      provider,
      dto.callbackUrl,
      dto.inviteToken,
      dto.intent,
    );
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(FeatureFlagGuard)
  @RequireFeature(OAUTH_FEATURE_FLAG)
  @PostApi({
    path: 'oauth/callback',
    summary: 'Conclui o login OAuth',
    description:
      'Troca o code por tokens no provider, resolve o usuário pelo email verificado e emite a sessão.',
    status: 'OK',
    authenticated: false,
    body: OauthCallbackDto,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Login realizado com sucesso',
          schema: { dto: OauthCallbackResponseDto },
        },
      ],
    },
  })
  async oauthCallback(
    @Body() dto: OauthCallbackDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.oauthCallback$.execute(
      dto.code,
      dto.state,
      extractRequestSource(request),
    );
    if (!('consentRequired' in result)) {
      setAuthCookies(response, result.tokens);
      return { user: result.user, callbackUrl: result.callbackUrl };
    }
    return result;
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(FeatureFlagGuard, CaptchaGuard)
  @RequireFeature(OAUTH_FEATURE_FLAG)
  @RequireCaptcha()
  @PostApi({
    path: 'oauth/signup/complete',
    summary: 'Conclui cadastro OAuth após consentimento',
    description:
      'Consome uma intenção OAuth de uso único após confirmação explícita e aceite dos termos.',
    status: 'OK',
    authenticated: false,
    body: OauthCompleteSignupDto,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Cadastro OAuth concluído',
          schema: { dto: OauthCallbackResponseDto },
        },
      ],
    },
  })
  async completeOauthSignup(
    @Body() dto: OauthCompleteSignupDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.oauthCallback$.completeSignup(
      dto.token,
      dto.acceptTerms,
      extractRequestSource(request),
    );
    setAuthCookies(response, result.tokens);
    return { user: result.user, callbackUrl: result.callbackUrl };
  }
}
