import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { ApiKeyService } from './api-key.service';
import { ApiKeyStrategy } from './api-key.strategy';
import { CreateApiKeyUseCase } from './use-cases/create-api-key.use-case';
import { ListApiKeysUseCase } from './use-cases/list-api-keys.use-case';
import { RevokeApiKeyUseCase } from './use-cases/revoke-api-key.use-case';
import { UpdateApiKeyScopesUseCase } from './use-cases/update-api-key-scopes.use-case';
import { ApiKeyController } from './api-key.controller';
import { ListApiKeysTool } from './ai-tools/list-api-keys.tool';
import { RevokeApiKeyTool } from './ai-tools/revoke-api-key.tool';
import { UpdateApiKeyScopesTool } from './ai-tools/update-api-key-scopes.tool';

@Module({
  imports: [PrismaModule, LoggingModule, PassportModule],
  controllers: [ApiKeyController],
  providers: [
    ApiKeyService,
    ApiKeyStrategy,
    CreateApiKeyUseCase,
    ListApiKeysUseCase,
    RevokeApiKeyUseCase,
    UpdateApiKeyScopesUseCase,
    ListApiKeysTool,
    RevokeApiKeyTool,
    UpdateApiKeyScopesTool,
  ],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
