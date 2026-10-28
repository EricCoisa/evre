import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { EmailModule } from '../email/email.module';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';
import { UserModule } from '../user/user.module';
import { CryptoModule } from '../../common/infrastructure/crypto/crypto.module';
import { FeatureFlagModule } from '../feature-flag/feature-flag.module';
import { CaptchaModule } from '../captcha/captcha.module';
import { ShortUrlModule } from '../short-url/short-url.module';

import { OidcDiscoveryService } from './oidc-discovery.service';
import { OAuthProviderService } from './oauth-provider.service';
import { LoginUseCase } from './use-cases/login.use-case';
import { RegisterUseCase } from './use-cases/register.use-case';
import { RefreshTokenUseCase } from './use-cases/refresh-token.use-case';
import { LogoutUseCase } from './use-cases/logout.use-case';
import { RequestPasswordResetUseCase } from './use-cases/request-password-reset.use-case';
import { ResetPasswordUseCase } from './use-cases/reset-password.use-case';
import { GenerateInviteUseCase } from './use-cases/generate-invite.use-case';
import { GetUserRoutesUseCase } from './use-cases/get-user-routes.use-case';
import { RouteModule } from '../route/route.module';
import { ValidateUserUseCase } from './use-cases/validate-user.use-case';
import { SignupUseCase } from './use-cases/signup.use-case';
import { GetInvitesUseCase } from './use-cases/get-invites.use-case';
import { DeleteInviteUseCase } from './use-cases/delete-invite.use-case';
import { ListInvitesTool } from './ai-tools/list-invites.tool';
import { GenerateInviteTool } from './ai-tools/generate-invite.tool';
import { DeleteInviteTool } from './ai-tools/delete-invite.tool';
import { OauthProvidersUseCase } from './use-cases/oauth-providers.use-case';
import { OauthAuthorizeUrlUseCase } from './use-cases/oauth-authorize-url.use-case';
import { OauthCallbackUseCase } from './use-cases/oauth-callback.use-case';
import { SaveOauthConfigUseCase } from './use-cases/save-oauth-config.use-case';
import { CheckForgotPasswordStatusUseCase } from './use-cases/check-forgot-password-status.use-case';
import { AuthCapabilities } from './auth.capabilities';

const USE_CASES = [
  LoginUseCase,
  RegisterUseCase,
  RefreshTokenUseCase,
  LogoutUseCase,
  RequestPasswordResetUseCase,
  ResetPasswordUseCase,
  GenerateInviteUseCase,
  GetUserRoutesUseCase,
  ValidateUserUseCase,
  SignupUseCase,
  GetInvitesUseCase,
  DeleteInviteUseCase,
  OauthProvidersUseCase,
  OauthAuthorizeUrlUseCase,
  OauthCallbackUseCase,
  SaveOauthConfigUseCase,
  CheckForgotPasswordStatusUseCase,
];

const AI_TOOLS = [ListInvitesTool, GenerateInviteTool, DeleteInviteTool];

@Module({
  imports: [
    RouteModule,
    ConfigModule,
    PassportModule,
    JwtModule.register({}),
    PrismaModule,
    LoggingModule,
    forwardRef(() => UserModule),
    EmailModule,
    SystemConfigurationModule,
    CryptoModule,
    // FeatureFlagModule: as rotas de OAuth são gateadas por @RequireFeature('OAUTH_LOGIN').
    FeatureFlagModule,
    // CaptchaModule: login e forgot-password são gateados por @RequireCaptcha().
    CaptchaModule,
    ShortUrlModule,
  ],
  controllers: [AuthController],
  providers: [
    LocalStrategy,
    JwtStrategy,
    OidcDiscoveryService,
    OAuthProviderService,
    ...USE_CASES,
    ...AI_TOOLS,
    AuthCapabilities,
  ],
  exports: [SignupUseCase, GenerateInviteUseCase, RegisterUseCase],
})
export class AuthModule {}
