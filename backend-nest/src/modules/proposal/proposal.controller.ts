import { Body, Controller, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { plainToInstance } from 'class-transformer';
import {
  DeleteApi,
  GetApi,
  PatchApi,
  PostApi,
} from '../../common/decorators/api-method.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { UpdateProposalLayoutDto } from './dto/update-proposal-layout.dto';
import { UpdateProposalTermsDto } from './dto/update-proposal-terms.dto';
import { UpdateProposalStatusDto } from './dto/update-proposal-status.dto';
import { ProposalDto } from './dto/proposal.dto';
import { ProposalVersionDto } from './dto/proposal-version.dto';
import { PublishProposalResponseDto } from './dto/publish-proposal-response.dto';
import { RevokeProposalPublicationResponseDto } from './dto/revoke-proposal-publication-response.dto';
import { AcceptProposalOfflineDto } from './dto/accept-proposal-offline.dto';
import { AcceptProposalVersionResponseDto } from './dto/accept-proposal-version-response.dto';
import { SendProposalDto } from './dto/send-proposal.dto';
import { SendProposalResponseDto } from './dto/send-proposal-response.dto';
import { ProposalSendDto } from './dto/proposal-send.dto';
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
import { AcceptProposalVersionUseCase } from './use-cases/accept-proposal-version.use-case';
import { SendProposalUseCase } from './use-cases/send-proposal.use-case';
import { ListProposalSendsUseCase } from './use-cases/list-proposal-sends.use-case';
import { ReopenProposalUseCase } from './use-cases/reopen-proposal.use-case';
import { ProposalAcceptanceSourceConst } from 'src/domain/proposal/proposalAcceptanceSource.const';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import {
  type PaginationQuery,
  PaginationQuerySchema,
} from 'src/common/schemas/pagination.schema';
import { PaginatedResponse } from 'src/common/types/pagination.types';

/** A página pública que consome o token é F1-06. */
@ApiTags('proposal')
@Controller('proposal')
export class ProposalController {
  constructor(
    private readonly findAllProposal: FindAllProposalUseCase,
    private readonly findOneProposal: FindOneProposalUseCase,
    private readonly createProposal: CreateProposalUseCase,
    private readonly updateProposal: UpdateProposalUseCase,
    private readonly removeProposal: RemoveProposalUseCase,
    private readonly updateProposalLayout: UpdateProposalLayoutUseCase,
    private readonly updateProposalTerms: UpdateProposalTermsUseCase,
    private readonly updateProposalStatus: UpdateProposalStatusUseCase,
    private readonly duplicateProposal: DuplicateProposalUseCase,
    private readonly publishProposal: PublishProposalUseCase,
    private readonly revokeProposalPublication: RevokeProposalPublicationUseCase,
    private readonly listProposalVersions: ListProposalVersionsUseCase,
    private readonly resolveCurrentProposalVersion: ResolveCurrentProposalVersionUseCase,
    private readonly acceptProposalVersion: AcceptProposalVersionUseCase,
    private readonly sendProposal: SendProposalUseCase,
    private readonly listProposalSends: ListProposalSendsUseCase,
    private readonly reopenProposal: ReopenProposalUseCase,
  ) {}

  @PostApi({
    summary: 'proposal.create.title',
    description: 'proposal.create.description',
    body: CreateProposalDto,
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
  })
  async create(
    @Body() dto: CreateProposalDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.createProposal.execute(dto, currentUser.id);
  }

  @GetApi({
    summary: 'proposal.list.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    queries: commonPaginationQueries,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Paginated response',
          schema: { dto: ProposalDto, isArray: true, isPagination: true },
        },
      ],
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponse<ProposalDto> | ProposalDto[]> {
    const result = await this.findAllProposal.execute(query, currentUser);

    if (Array.isArray(result)) {
      return plainToInstance(ProposalDto, result);
    }

    return {
      data: plainToInstance(ProposalDto, result.data),
      meta: result.meta,
      ...(result.filter ? { filter: result.filter } : {}),
    };
  }

  @GetApi({
    path: ':id',
    summary: 'proposal.find.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Proposal found',
          schema: { dto: ProposalDto },
        },
      ],
    },
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.findOneProposal.execute(id, currentUser);
  }

  @PatchApi({
    path: ':id',
    summary: 'proposal.update.title',
    body: UpdateProposalDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Proposal updated',
          schema: { dto: ProposalDto },
        },
      ],
    },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProposalDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.updateProposal.execute(id, dto, currentUser);
  }

  @DeleteApi({
    path: ':id',
    summary: 'proposal.delete.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Proposal archived',
          schema: { dto: ProposalDto },
        },
      ],
    },
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.removeProposal.execute(id, currentUser);
  }

  @PostApi({
    path: ':id/duplicate',
    summary: 'proposal.duplicate.title',
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Proposal duplicated as a new draft',
          schema: { dto: ProposalDto },
        },
      ],
    },
  })
  async duplicate(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.duplicateProposal.execute(id, currentUser);
  }

  @PatchApi({
    path: ':id/layout',
    summary: 'proposal.layout.update.title',
    body: UpdateProposalLayoutDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Proposal layout updated',
          schema: { dto: ProposalDto },
        },
      ],
    },
  })
  async updateLayout(
    @Param('id') id: string,
    @Body() dto: UpdateProposalLayoutDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.updateProposalLayout.execute(id, dto, currentUser);
  }

  @PatchApi({
    path: ':id/terms',
    summary: 'proposal.terms.update.title',
    body: UpdateProposalTermsDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Proposal commercial terms updated',
          schema: { dto: ProposalDto },
        },
      ],
    },
  })
  async updateTerms(
    @Param('id') id: string,
    @Body() dto: UpdateProposalTermsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.updateProposalTerms.execute(id, dto, currentUser);
  }

  @PatchApi({
    path: ':id/status',
    summary: 'proposal.status.update.title',
    body: UpdateProposalStatusDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Proposal status updated',
          schema: { dto: ProposalDto },
        },
      ],
    },
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProposalStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.updateProposalStatus.execute(id, dto, currentUser);
  }

  @PostApi({
    path: ':id/publish',
    summary: 'proposal.publish.title',
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Proposal published, new version is now live',
          schema: { dto: PublishProposalResponseDto },
        },
      ],
    },
  })
  async publish(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.publishProposal.execute(id, currentUser);
  }

  @PostApi({
    path: ':id/reopen',
    summary: 'proposal.reopen.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [
        {
          status: 'OK',
          description:
            'Proposal returned to DRAFT; active public version revoked',
          schema: { dto: ProposalDto },
        },
      ],
    },
  })
  async reopen(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.reopenProposal.execute(id, currentUser);
  }

  @PostApi({
    path: ':id/revoke',
    summary: 'proposal.revoke.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Current public version revoked',
          schema: { dto: RevokeProposalPublicationResponseDto },
        },
      ],
    },
  })
  async revoke(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.revokeProposalPublication.execute(id, currentUser);
  }

  @GetApi({
    path: ':id/versions',
    summary: 'proposal.versions.list.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Versions of the proposal, newest first',
          schema: { dto: ProposalVersionDto, isArray: true },
        },
      ],
    },
  })
  async listVersions(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.listProposalVersions.execute(id, currentUser);
  }

  @PostApi({
    path: ':id/accept-offline',
    summary: 'proposal.accept.offline.title',
    body: AcceptProposalOfflineDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Acceptance recorded on behalf of the client',
          schema: { dto: AcceptProposalVersionResponseDto },
        },
      ],
    },
  })
  async acceptOffline(
    @Param('id') id: string,
    @Body() dto: AcceptProposalOfflineDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    // Nunca a versão escolhida pelo chamador — só a vigente (a mais recente).
    const current = await this.resolveCurrentProposalVersion.execute(
      id,
      currentUser,
    );
    return this.acceptProposalVersion.execute({
      versionId: current.id,
      source: ProposalAcceptanceSourceConst.OFFLINE,
      note: dto.note,
      acceptedById: currentUser.id,
    });
  }

  @PostApi({
    path: ':id/send',
    summary: 'proposal.send.title',
    body: SendProposalDto,
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [
        {
          status: 'OK',
          description:
            'Send attempted; succeeded tells whether the channel delivered it',
          schema: { dto: SendProposalResponseDto },
        },
      ],
    },
  })
  async send(
    @Param('id') id: string,
    @Body() dto: SendProposalDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.sendProposal.execute(
      {
        proposalId: id,
        phone: dto.phone,
        templateId: dto.templateId,
        values: dto.values,
        headerImageUrl: dto.headerImageUrl,
      },
      currentUser,
    );
  }

  @GetApi({
    path: ':id/sends',
    summary: 'proposal.sends.list.title',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN', 'MODERATOR'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Send history of the proposal, newest first',
          schema: { dto: ProposalSendDto, isArray: true },
        },
      ],
    },
  })
  async listSends(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.listProposalSends.execute(id, currentUser);
  }
}
