import { Controller, Param, Body, Query } from '@nestjs/common';

import { ApiTags } from '@nestjs/swagger';
import {
  GetApi,
  PostApi,
  PutApi,
} from '../../common/decorators/api-method.decorator';
import { ProposalDto } from './dto/proposal.dto';
import { plainToInstance } from 'class-transformer';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalContentDto } from './dto/update-proposal-content.dto';
import { ProposalService } from './proposal.service';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  PaginationQuerySchema,
  type PaginationQuery,
} from '../../common/schemas/pagination.schema';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';

@ApiTags('proposal')
@Controller('proposals')
export class ProposalController {
  constructor(private readonly proposalService: ProposalService) {}

  @GetApi({
    summary: 'Lista propostas',
    description: 'Retorna uma lista paginada de propostas do sistema',
    status: 'OK',
    authenticated: true,
    queries: commonPaginationQueries,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Resposta paginada',
          schema: { dto: ProposalDto, isArray: true, isPagination: true },
        },
      ],
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<ProposalDto> | ProposalDto[]> {
    const result = await this.proposalService.findAll(query);

    if (Array.isArray(result)) {
      return plainToInstance(ProposalDto, result);
    }

    return {
      data: plainToInstance(ProposalDto, result.data),
      meta: result.meta,
      ...(result.filter ? { filter: result.filter } : {}),
    };
  }

  @PostApi({
    summary: 'Criar nova proposta',
    description: 'Cria uma nova proposta em status DRAFT',
    status: 'CREATED',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Proposta criada com sucesso',
          schema: { dto: ProposalDto },
        },
      ],
    },
  })
  async create(@Body() dto: CreateProposalDto): Promise<ProposalDto> {
    const proposal = await this.proposalService.create(dto);
    return plainToInstance(ProposalDto, proposal);
  }

  @GetApi({
    path: ':id',
    summary: 'Obter proposta por ID',
    description: 'Retorna os dados de uma proposta específica (autenticado)',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Dados da proposta',
          schema: { dto: ProposalDto },
        },
      ],
    },
  })
  async findOne(@Param('id') id: string): Promise<ProposalDto> {
    const proposal = await this.proposalService.findOne(id);
    return plainToInstance(ProposalDto, proposal);
  }

  @PutApi({
    path: ':id/content',
    summary: 'Atualizar conteúdo da proposta',
    description: 'Atualiza o conteúdo de uma proposta em status DRAFT',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Conteúdo atualizado com sucesso',
          schema: { dto: ProposalDto },
        },
      ],
    },
  })
  async updateContent(
    @Param('id') id: string,
    @Body() dto: UpdateProposalContentDto,
  ): Promise<ProposalDto> {
    const proposal = await this.proposalService.update(id, dto);
    return plainToInstance(ProposalDto, proposal);
  }

  @PostApi({
    path: ':id/send',
    summary: 'Enviar proposta',
    description: 'Altera o status da proposta de DRAFT para SENT',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Proposta enviada com sucesso',
          schema: { dto: ProposalDto },
        },
      ],
    },
  })
  async send(@Param('id') id: string): Promise<ProposalDto> {
    const proposal = await this.proposalService.send(id);
    return plainToInstance(ProposalDto, proposal);
  }

  @GetApi({
    path: 'company/:companyId',
    summary: 'Listar propostas da empresa',
    description:
      'Retorna todas as propostas de uma empresa específica. Valida acesso do usuário à empresa.',
    status: 'OK',
    authenticated: true,
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Lista de propostas',
          schema: { dto: ProposalDto, isArray: true },
        },
      ],
    },
  })
  async findByCompany(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProposalDto[]> {
    const proposals = await this.proposalService.findByCompany(companyId, user);
    return plainToInstance(ProposalDto, proposals);
  }

  @GetApi({
    path: 'public/:id',
    summary: 'Obter proposta (público)',
    description: 'Retorna os dados de uma proposta específica sem autenticação',
    status: 'OK',
    authenticated: false,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Dados da proposta',
          schema: { dto: ProposalDto },
        },
      ],
    },
  })
  async getPublicProposal(@Param('id') id: string): Promise<ProposalDto> {
    const proposal = await this.proposalService.findOne(id);
    return plainToInstance(ProposalDto, proposal);
  }

  @PostApi({
    path: 'public/:id/approve',
    summary: 'Aprovar proposta (público)',
    description: 'Aprova uma proposta sem necessidade de autenticação',
    status: 'OK',
    authenticated: false,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Proposta aprovada com sucesso',
          schema: { dto: ProposalDto },
        },
      ],
    },
  })
  async approvePublic(@Param('id') id: string): Promise<ProposalDto> {
    const proposal = await this.proposalService.approve(id);
    return plainToInstance(ProposalDto, proposal);
  }
}
