import { Module } from '@nestjs/common';
import { ProposalModule } from './modules/proposal/proposal.module';
import { CompanyModule } from './modules/company/company.module';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { ScheduleModule } from '@nestjs/schedule';
import {
  I18nModule,
  AcceptLanguageResolver,
  QueryResolver,
  HeaderResolver,
} from 'nestjs-i18n';
import * as path from 'path';
import RedisMock from 'ioredis-mock';
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
import { CmsModule } from './modules/cms/cms.module';
import { CaptchaModule } from './modules/captcha/captcha.module';
import { SentryConfigModule } from './modules/sentry-config/sentry-config.module';
import { StorageModule } from './modules/storage/storage.module';
import { PageBuilderModule } from './modules/page-builder/page-builder.module';
import { McpModule } from './modules/mcp/mcp.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { VerificationModule } from './modules/verification/verification.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ShortUrlModule } from './modules/short-url/short-url.module';

// Openapi-only module — ioredis-mock replaces Redis so BullMQ registers
// all queue tokens without a real connection; ThrottlerModule uses in-memory storage.
const RedisMockCtor = RedisMock as unknown as new () => Redis;
const redisConnection = new RedisMockCtor();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: 'warn',
        transport: { target: 'pino-pretty', options: { singleLine: true } },
      },
    }),

    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, 'i18n/'),
        watch: false,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        new HeaderResolver(['x-language']),
      ],
    }),

    // ioredis-mock: in-memory Redis — BullMQ queues and workers register normally
    BullModule.forRoot({
      connection: redisConnection,
    }),

    // in-memory throttler — no Redis storage needed for schema generation
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

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
    RoleModule,
    FeatureFlagModule,
    CapabilityModule,
    AiModule,
    ApiKeyModule,
    CaptchaModule,
    SentryConfigModule,
    StorageModule,
    PageBuilderModule,
    McpModule,
    MessagingModule,
    VerificationModule,
    NotificationModule,
    ShortUrlModule,
    CompanyModule,
    ProposalModule,
  ],
})
export class AppOpenApiModule {}
