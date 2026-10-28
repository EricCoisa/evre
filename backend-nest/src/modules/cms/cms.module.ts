import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { CryptoModule } from '../../common/infrastructure/crypto/crypto.module';
import { UserRouteAccessModule } from '../user-route-access/user-route-access.module';
import { EnsurePayloadUserAndLoginUseCase } from './use-cases/ensure-payload-user-and-login.use-case';
import { CheckCmsAccessUseCase } from './use-cases/check-cms-access.use-case';
import { CmsAgentBridgeService } from './services/cms-agent-bridge.service';
import { DescribeCmsSchemaTool } from './ai-tools/describe-cms-schema.tool';
import { GetCmsDocumentTool } from './ai-tools/get-cms-document.tool';
import { UpdateCmsDocumentTool } from './ai-tools/update-cms-document.tool';
import { CmsRouteCeiling } from './cms.route-ceiling';

@Module({
  imports: [
    PrismaModule,
    LoggingModule,
    JwtModule.register({ global: false }),
    ConfigModule,
    CryptoModule,
    UserRouteAccessModule,
  ],
  controllers: [CmsController],
  providers: [
    CmsService,
    EnsurePayloadUserAndLoginUseCase,
    CheckCmsAccessUseCase,
    CmsAgentBridgeService,
    DescribeCmsSchemaTool,
    GetCmsDocumentTool,
    UpdateCmsDocumentTool,
    CmsRouteCeiling,
  ],
  exports: [CmsService],
})
export class CmsModule {}
