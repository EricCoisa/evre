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
import { FindAllProposalUseCase } from './use-cases/find-all.use-case';
import { FindOneProposalUseCase } from './use-cases/find-one.use-case';
import { CreateProposalUseCase } from './use-cases/create.use-case';
import { UpdateProposalUseCase } from './use-cases/update.use-case';
import { RemoveProposalUseCase } from './use-cases/remove.use-case';
import { UpdateProposalLayoutUseCase } from './use-cases/update-proposal-layout.use-case';
import { UpdateProposalTermsUseCase } from './use-cases/update-proposal-terms.use-case';
import { UpdateProposalStatusUseCase } from './use-cases/update-proposal-status.use-case';
import { DuplicateProposalUseCase } from './use-cases/duplicate-proposal.use-case';
import { UploadProposalArtifactUseCase } from './use-cases/upload-proposal-artifact.use-case';
import { ArchiveProposalArtifactUseCase } from './use-cases/archive-proposal-artifact.use-case';
import { ListProposalArtifactsUseCase } from './use-cases/list-proposal-artifacts.use-case';
import { PublishProposalUseCase } from './use-cases/publish-proposal.use-case';
import { RevokeProposalPublicationUseCase } from './use-cases/revoke-proposal-publication.use-case';
import { ListProposalVersionsUseCase } from './use-cases/list-proposal-versions.use-case';
import { GetPublicProposalUseCase } from './use-cases/get-public-proposal.use-case';
import { RegisterProposalOpenUseCase } from './use-cases/register-proposal-open.use-case';
import { RequestProposalRenewalUseCase } from './use-cases/request-proposal-renewal.use-case';
import { ResolvePublicProposalVersionUseCase } from './use-cases/resolve-public-proposal-version.use-case';
import { AcceptProposalVersionUseCase } from './use-cases/accept-proposal-version.use-case';
import { BuildProposalPublicLinkUseCase } from './use-cases/build-proposal-public-link.use-case';
import { SendProposalUseCase } from './use-cases/send-proposal.use-case';
import { ListProposalSendsUseCase } from './use-cases/list-proposal-sends.use-case';
import { ProposalRouteCeiling } from './proposal.route-ceiling';

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
  UploadProposalArtifactUseCase,
  ArchiveProposalArtifactUseCase,
  ListProposalArtifactsUseCase,
  PublishProposalUseCase,
  RevokeProposalPublicationUseCase,
  ListProposalVersionsUseCase,
  GetPublicProposalUseCase,
  RegisterProposalOpenUseCase,
  RequestProposalRenewalUseCase,
  ResolvePublicProposalVersionUseCase,
  AcceptProposalVersionUseCase,
  BuildProposalPublicLinkUseCase,
  SendProposalUseCase,
  ListProposalSendsUseCase,
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
  ],
  controllers: [ProposalController, ProposalPublicController],
  providers: [...USE_CASES, ProposalRouteCeiling],
  // Exporte só o que outro módulo injetar.
  exports: [FindOneProposalUseCase],
})
export class ProposalModule {}
