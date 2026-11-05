import { Module } from '@nestjs/common';
import { ArtifactController } from './artifact.controller';
import { ArtifactPublicController } from './artifact-public.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { StorageModule } from '../storage/storage.module';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';
import { UploadArtifactUseCase } from './use-cases/upload-artifact.use-case';
import { ListArtifactsUseCase } from './use-cases/list-artifacts.use-case';
import { ArchiveArtifactUseCase } from './use-cases/archive-artifact.use-case';
import { DeleteArtifactUseCase } from './use-cases/delete-artifact.use-case';
import { ViewArtifactUseCase } from './use-cases/view-artifact.use-case';
import { ViewPublicArtifactUseCase } from './use-cases/view-public-artifact.use-case';
import { PublishReferencedArtifactsUseCase } from './use-cases/publish-referenced-artifacts.use-case';
import { ArtifactRouteCeiling } from './artifact.route-ceiling';
import { ListArtifactsTool } from './ai-tools/list-artifacts.tool';
import { ArchiveArtifactTool } from './ai-tools/archive-artifact.tool';
import { DeleteArtifactTool } from './ai-tools/delete-artifact.tool';

const USE_CASES = [
  UploadArtifactUseCase,
  ListArtifactsUseCase,
  ArchiveArtifactUseCase,
  DeleteArtifactUseCase,
  ViewArtifactUseCase,
  ViewPublicArtifactUseCase,
  PublishReferencedArtifactsUseCase,
];

const AI_TOOLS = [ListArtifactsTool, ArchiveArtifactTool, DeleteArtifactTool];

@Module({
  imports: [
    PrismaModule,
    LoggingModule,
    StorageModule,
    SystemConfigurationModule,
  ],
  controllers: [ArtifactController, ArtifactPublicController],
  providers: [...USE_CASES, ...AI_TOOLS, ArtifactRouteCeiling],
  // Dependência unidirecional: Artifact nunca importa nada de quem o consome.
  exports: [PublishReferencedArtifactsUseCase],
})
export class ArtifactModule {}
