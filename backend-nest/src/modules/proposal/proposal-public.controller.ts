import { Body, Controller, Param, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { GetApi, PostApi } from '../../common/decorators/api-method.decorator';
import { extractRequestSource } from '../../common/utils/request-source.util';
import { ProposalAcceptanceSourceConst } from 'src/domain/proposal/proposalAcceptanceSource.const';
import {
  GetPublicProposalUseCase,
  type GetPublicProposalOutput,
} from './use-cases/get-public-proposal.use-case';
import { RegisterProposalOpenUseCase } from './use-cases/register-proposal-open.use-case';
import { RequestProposalRenewalUseCase } from './use-cases/request-proposal-renewal.use-case';
import { ResolvePublicProposalVersionUseCase } from './use-cases/resolve-public-proposal-version.use-case';
import {
  AcceptProposalVersionUseCase,
  type AcceptProposalVersionOutput,
} from './use-cases/accept-proposal-version.use-case';
import { PublicProposalDto } from './dto/public-proposal.dto';
import { AcceptPublicProposalDto } from './dto/accept-public-proposal.dto';
import { AcceptProposalVersionResponseDto } from './dto/accept-proposal-version-response.dto';

/** Única rota deste módulo sem `roles` — página pública da proposta, sem login. A base de
 * segurança é o profile `proposal` (`dataSources: 'none'`): o layout publicado não tem nenhuma
 * fonte de dado para o validador aceitar, então não há nada autenticado para este endpoint vazar. */
@ApiTags('proposal-public')
@Controller('proposals/public')
export class ProposalPublicController {
  constructor(
    private readonly getPublicProposal: GetPublicProposalUseCase,
    private readonly registerProposalOpen: RegisterProposalOpenUseCase,
    private readonly requestProposalRenewal: RequestProposalRenewalUseCase,
    private readonly resolvePublicProposalVersion: ResolvePublicProposalVersionUseCase,
    private readonly acceptProposalVersion: AcceptProposalVersionUseCase,
  ) {}

  @GetApi({
    path: ':token',
    summary: 'proposal.public.get.title',
    status: 'OK',
    authenticated: false,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Public proposal content',
          schema: { dto: PublicProposalDto },
        },
      ],
    },
  })
  // Rota anônima e enumerável: teto mais restritivo que o default global (100/min).
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getPublic(
    @Param('token') token: string,
    @Req() request: Request,
  ): Promise<GetPublicProposalOutput> {
    const result = await this.getPublicProposal.execute(token);
    const source = extractRequestSource(request);
    await this.registerProposalOpen.execute({
      token,
      ip: source.ip,
      userAgent: source.userAgent,
    });
    return result;
  }

  @PostApi({
    path: ':token/renew-request',
    summary: 'proposal.public.renew.title',
    status: 'OK',
    authenticated: false,
  })
  // Idempotente por janela de tempo — mesmo custo de um e-mail/WhatsApp disparado ao dono.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async requestRenewal(@Param('token') token: string): Promise<void> {
    await this.requestProposalRenewal.execute(token);
  }

  @PostApi({
    path: ':token/accept',
    summary: 'proposal.accept.title',
    body: AcceptPublicProposalDto,
    status: 'OK',
    authenticated: false,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Proposal accepted by the client',
          schema: { dto: AcceptProposalVersionResponseDto },
        },
      ],
    },
  })
  // Mutação anônima que grava uma decisão comercial — mesmo teto de renew-request.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async accept(
    @Param('token') token: string,
    @Body() dto: AcceptPublicProposalDto,
    @Req() request: Request,
  ): Promise<AcceptProposalVersionOutput> {
    const resolved = await this.resolvePublicProposalVersion.execute(token);
    const source = extractRequestSource(request);
    return this.acceptProposalVersion.execute({
      versionId: resolved.id,
      source: ProposalAcceptanceSourceConst.LINK,
      name: dto.name,
      email: dto.email,
      ip: source.ip,
      userAgent: source.userAgent,
    });
  }
}
