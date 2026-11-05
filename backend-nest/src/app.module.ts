import { Module } from '@nestjs/common';
import { ProposalModule } from './modules/proposal/proposal.module';
import { ArtifactModule } from './modules/artifact/artifact.module';
import { CompanyModule } from './modules/company/company.module';
import { NotificationModule } from './modules/notification/notification.module';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CmsModule } from './modules/cms/cms.module';
import { PageBuilderModule } from './modules/page-builder/page-builder.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisThrottlerStorage } from './common/infrastructure/throttler/redis-throttler.storage';
import {
  I18nModule,
  AcceptLanguageResolver,
  QueryResolver,
  HeaderResolver,
} from 'nestjs-i18n';
import * as path from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './modules/user/user.module';
import { HealthModule } from './modules/health/health.module';
import { LoggingModule } from './modules/logging/logging.module';
import { AuthModule } from './modules/auth/auth.module';
import { RouteModule } from './modules/route/route.module';
import { UserRouteAccessModule } from './modules/user-route-access/user-route-access.module';
import { RoleRouteAccessModule } from './modules/role-route-access/role-route-access.module';
import { SystemConfigurationModule } from './modules/system-configuration/system-configuration.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { UserConfigurationModule } from './modules/user-configuration/user-configuration.module';
import { UserConfigurationDefinitionModule } from './modules/user-configuration-definition/user-configuration-definition.module';
import { ClientLogModule } from './modules/client-log/client-log.module';
import { PayloadUserModule } from './modules/auth/adapters/payload-user.module';
import { RedisModule } from './common/infrastructure/redis/redis.module';
import { RouteCeilingModule } from './common/infrastructure/route-ceiling/route-ceiling.module';
import { ResourceAccessModule } from './common/infrastructure/resource-access/resource-access.module';
import { RoleModule } from './modules/role/role.module';
import { FeatureFlagModule } from './modules/feature-flag/feature-flag.module';
import { CapabilityModule } from './modules/capability/capability.module';
import { AiModule } from './modules/ai/ai.module';
import { ApiKeyModule } from './modules/api-key/api-key.module';
import { CaptchaModule } from './modules/captcha/captcha.module';
import { SentryConfigModule } from './modules/sentry-config/sentry-config.module';
import { StorageModule } from './modules/storage/storage.module';
import { McpModule } from './modules/mcp/mcp.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { VerificationModule } from './modules/verification/verification.module';
import { ShortUrlModule } from './modules/short-url/short-url.module';
import { SentryModule } from '@sentry/nestjs/setup';
import { ProjectModule } from './modules/project/project.module';

@Module({
  imports: [
    // Liga o contexto de request (rota, usuário, headers) ao evento enviado
    // pelo AllExceptionsFilter. No-op quando SENTRY_DSN não está setado.
    SentryModule.forRoot(),

    ConfigModule.forRoot({
      isGlobal: true,
    }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),

    // I18n Configuration
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, 'i18n/'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        new HeaderResolver(['x-language']),
      ],
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        },
        // APP_NAME isola as filas de cada app num Redis compartilhado entre projetos.
        prefix: process.env.APP_NAME,
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: 60000, limit: 100 }], // 100 req/min default; endpoints sensíveis sobrescrevem com @Throttle
        storage: new RedisThrottlerStorage(config),
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    RouteCeilingModule,
    ResourceAccessModule,
    PayloadUserModule,
    LoggingModule,
    AuthModule,
    UserModule,
    HealthModule,
    RouteModule,
    UserRouteAccessModule,
    RoleRouteAccessModule,
    SystemConfigurationModule,
    UserConfigurationDefinitionModule,
    UserConfigurationModule,
    TasksModule,
    ClientLogModule,
    CmsModule,
    PageBuilderModule,
    RoleModule,
    FeatureFlagModule,
    CapabilityModule,
    AiModule,
    ApiKeyModule,
    CaptchaModule,
    SentryConfigModule,
    StorageModule,
    McpModule,
    MessagingModule,
    VerificationModule,
    NotificationModule,
    ShortUrlModule,
    CompanyModule,
    ArtifactModule,
    ProposalModule,
    ProjectModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
