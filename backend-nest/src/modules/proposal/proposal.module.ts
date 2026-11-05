import { Module } from '@nestjs/common';
import { ProposalController } from './proposal.controller';
import { ProposalPublicController } from './proposal-public.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { StorageModule } from '../storage/storage.module';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';
import { NotificationModule } from '../notification/notification.module';
import { ShortUrlModule } from '../short-url/short-url.module';
import { MessagingModule } from '../messaging/messaging.module';
import { ArtifactModule } from '../artifact/artifact.module';
import { FindAllProposalUseCase } from './use-cases/find-all.use-case';
import { FindOneProposalUseCase } from './use-cases/find-one.use-case';
import { CreateProposalUseCase } from './use-cases/create.use-case';
import { UpdateProposalUseCase } from './use-cases/update.use-case';
import { RemoveProposalUseCase } from './use-cases/remove.use-case';
import { UpdateProposalLayoutUseCase } from './use-cases/update-proposal-layout.use-case';
import { UpdateProposalTermsUseCase } from './use-cases/update-proposal-terms.use-case';
import { UpdateProposalStatusUseCase } from './use-cases/update-proposal-status.use-case';
import { DuplicateProposalUseCase } from './use-cases/duplicate-proposal.use-case';
import { PublishProposalUseCase } from './use-cases/publish-proposal.use-case';
import { RevokeProposalPublicationUseCase } from './use-cases/revoke-proposal-publication.use-case';
import { ListProposalVersionsUseCase } from './use-cases/list-proposal-versions.use-case';
import { ResolveCurrentProposalVersionUseCase } from './use-cases/resolve-current-proposal-version.use-case';
import { GetPublicProposalUseCase } from './use-cases/get-public-proposal.use-case';
import { RegisterProposalOpenUseCase } from './use-cases/register-proposal-open.use-case';
import { RequestProposalRenewalUseCase } from './use-cases/request-proposal-renewal.use-case';
import { ResolvePublicProposalVersionUseCase } from './use-cases/resolve-public-proposal-version.use-case';
import { AcceptProposalVersionUseCase } from './use-cases/accept-proposal-version.use-case';
import { BuildProposalPublicLinkUseCase } from './use-cases/build-proposal-public-link.use-case';
import { SendProposalUseCase } from './use-cases/send-proposal.use-case';
import { ListProposalSendsUseCase } from './use-cases/list-proposal-sends.use-case';
import { ReopenProposalUseCase } from './use-cases/reopen-proposal.use-case';
import { ProposalRouteCeiling } from './proposal.route-ceiling';
import { ListProposalsTool } from './ai-tools/list-proposals.tool';
import { GetProposalTool } from './ai-tools/get-proposal.tool';
import { CreateProposalTool } from './ai-tools/create-proposal.tool';
import { UpdateProposalTool } from './ai-tools/update-proposal.tool';
import { RemoveProposalTool } from './ai-tools/remove-proposal.tool';
import { DuplicateProposalTool } from './ai-tools/duplicate-proposal.tool';
import { UpdateProposalLayoutTool } from './ai-tools/update-proposal-layout.tool';
import { UpdateProposalTermsTool } from './ai-tools/update-proposal-terms.tool';
import { UpdateProposalStatusTool } from './ai-tools/update-proposal-status.tool';
import { PublishProposalTool } from './ai-tools/publish-proposal.tool';
import { ReopenProposalTool } from './ai-tools/reopen-proposal.tool';
import { RevokeProposalPublicationTool } from './ai-tools/revoke-proposal-publication.tool';
import { ListProposalVersionsTool } from './ai-tools/list-proposal-versions.tool';
import { AcceptProposalOfflineTool } from './ai-tools/accept-proposal-offline.tool';
import { SendProposalTool } from './ai-tools/send-proposal.tool';
import { ListProposalSendsTool } from './ai-tools/list-proposal-sends.tool';

const USE_CASES = [
  FindAllProposalUseCase,
  FindOneProposalUseCase,
  CreateProposalUseCase,
  UpdateProposalUseCase,
  RemoveProposalUseCase,
  UpdateProposalLayoutUseCase,
  UpdateProposalTermsUseCase,
  UpdateProposalStatusUseCase,
  DuplicateProposalUseCase,
  PublishProposalUseCase,
  RevokeProposalPublicationUseCase,
  ListProposalVersionsUseCase,
  ResolveCurrentProposalVersionUseCase,
  GetPublicProposalUseCase,
  RegisterProposalOpenUseCase,
  RequestProposalRenewalUseCase,
  ResolvePublicProposalVersionUseCase,
  AcceptProposalVersionUseCase,
  BuildProposalPublicLinkUseCase,
  SendProposalUseCase,
  ListProposalSendsUseCase,
  ReopenProposalUseCase,
];

const AI_TOOLS = [
  ListProposalsTool,
  GetProposalTool,
  CreateProposalTool,
  UpdateProposalTool,
  RemoveProposalTool,
  DuplicateProposalTool,
  UpdateProposalLayoutTool,
  UpdateProposalTermsTool,
  UpdateProposalStatusTool,
  PublishProposalTool,
  ReopenProposalTool,
  RevokeProposalPublicationTool,
  ListProposalVersionsTool,
  AcceptProposalOfflineTool,
  SendProposalTool,
  ListProposalSendsTool,
];

@Module({
  imports: [
    PrismaModule,
    LoggingModule,
    StorageModule,
    SystemConfigurationModule,
    NotificationModule,
    ShortUrlModule,
    MessagingModule,
    ArtifactModule,
  ],
  controllers: [ProposalController, ProposalPublicController],
  providers: [...USE_CASES, ...AI_TOOLS, ProposalRouteCeiling],
  // Exporte só o que outro módulo injetar.
  exports: [FindOneProposalUseCase],
})
export class ProposalModule {}
