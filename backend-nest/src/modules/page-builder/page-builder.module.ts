import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { UserConfigurationModule } from '../user-configuration/user-configuration.module';
import { FeatureFlagModule } from '../feature-flag/feature-flag.module';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';
import { PageSourceRegistry } from './page-source-registry.service';
import { PageBuilderBridgeService } from './page-builder-bridge.service';
import { PageLayoutValidator } from './page-layout-validator.service';
import { SetPageLayoutUseCase } from './use-cases/set-page-layout.use-case';
import { GetSystemPageLayoutUseCase } from './use-cases/get-system-page-layout.use-case';
import { SetSystemPageLayoutUseCase } from './use-cases/set-system-page-layout.use-case';
import { DescribePageBuilderTool } from './ai-tools/describe-page-builder.tool';
import { SetPageLayoutTool } from './ai-tools/set-page-layout.tool';
import { PageBuilderController } from './page-builder.controller';

/** Catálogo de fontes `pageSource`, escrita de layout e os dois clientes dessa regra: agente e editor. */
@Module({
  // Módulos usados: FeatureFlagModule para o gate do controller, SystemConfigurationModule para o layout padrão.
  imports: [
    DiscoveryModule,
    UserConfigurationModule,
    FeatureFlagModule,
    SystemConfigurationModule,
  ],
  controllers: [PageBuilderController],
  providers: [
    PageSourceRegistry,
    PageBuilderBridgeService,
    PageLayoutValidator,
    SetPageLayoutUseCase,
    GetSystemPageLayoutUseCase,
    SetSystemPageLayoutUseCase,
    DescribePageBuilderTool,
    SetPageLayoutTool,
  ],
  exports: [PageSourceRegistry],
})
export class PageBuilderModule {}
