import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { FeatureFlagModule } from '../feature-flag/feature-flag.module';
import { LoggingModule } from '../logging/logging.module';
import { McpConnectionsController } from './mcp-connections.controller';
import { McpDiscoveryController } from './mcp-discovery.controller';
import { McpOauthController } from './mcp-oauth.controller';
import { McpAuthGuard } from './mcp-auth.guard';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { McpTokenService } from './mcp-token.service';
import { AuthorizeUseCase } from './use-cases/authorize.use-case';
import { ConnectionsUseCase } from './use-cases/connections.use-case';
import { ExchangeTokenUseCase } from './use-cases/exchange-token.use-case';
import { RegisterClientUseCase } from './use-cases/register-client.use-case';

/** Módulo do conector MCP remoto: endpoint Streamable HTTP e o Authorization Server OAuth 2.1 que o protege. */
@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    PrismaModule,
    LoggingModule,
    AiModule,
    FeatureFlagModule,
  ],
  controllers: [
    McpDiscoveryController,
    McpOauthController,
    McpConnectionsController,
    McpController,
  ],
  providers: [
    McpService,
    McpTokenService,
    McpAuthGuard,
    RegisterClientUseCase,
    AuthorizeUseCase,
    ExchangeTokenUseCase,
    ConnectionsUseCase,
  ],
})
export class McpModule {}
