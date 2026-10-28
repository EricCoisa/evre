import { Module } from '@nestjs/common';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';
import { SentryConfigController } from './sentry-config.controller';
import { SentryConfigService } from './sentry-config.service';
import { SaveSentryConfigUseCase } from './use-cases/save-sentry-config.use-case';

/** `SentryConfig` configura o DSN; o `SentryModule` do `@sentry/nestjs/setup` liga o SDK. */
@Module({
  imports: [SystemConfigurationModule],
  controllers: [SentryConfigController],
  providers: [SentryConfigService, SaveSentryConfigUseCase],
  exports: [SentryConfigService],
})
export class SentryConfigModule {}
