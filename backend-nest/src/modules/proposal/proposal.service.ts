import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from '../../common/types/logging.types';
import { Proposal } from 'src/domain/proposal/proposal.entity';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalContentDto } from './dto/update-proposal-content.dto';
import {
  ProposalStatus,
  ProposalStatusConst,
} from 'src/domain/proposal/proposalStatus.const';
import { IBaseService } from 'src/domain/interface/base-service.interface';
import type { PaginationQuery } from '../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../common/types/pagination.types';

@Injectable()
export class ProposalService implements Omit<IBaseService<Proposal>, 'remove'> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  //TODO: OK
  async findAll(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<Proposal> | Proposal[]> {
    const { page, limit, pagination, search, filter } = query;

    // Constrói a cláusula where separando search e filter
    const where: {
      OR?: Array<{
        companyId?: { contains: string };
      }>;
      status?: ProposalStatus;
      companyId?: string;
    } = {};

    // Aplica filtro de busca global (search)
    if (search) {
      where.OR = [{ companyId: { contains: search } }];
    }

    // Aplica filtros específicos (filter)
    if (filter?.status) {
      where.status = filter.status as ProposalStatus;
    }

    if (filter?.companyId) {
      where.companyId = filter.companyId;
    }

    if (!pagination) {
      // Retorna todas as propostas sem paginação
      return await this.prisma.proposal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
    }

    // Com paginação
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.proposal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.proposal.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const statusSet = Object.values(ProposalStatusConst);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
      filter: {
        status: Array.from(statusSet),
      },
    };
  }

  //TODO: OK
  async findOne(id: string): Promise<Proposal> {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
    });

    if (!proposal) {
      throw new NotFoundException(this.i18n.t('proposal.not_found'));
    }

    return proposal;
  }

  //TODO: OK
  async create(
    dto: CreateProposalDto,
    performedById?: string,
  ): Promise<Proposal> {
    // Valida se a company existe
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException(this.i18n.t('company.not_found'));
    }

    // Valida se o content é JSON válido
    try {
      JSON.parse(dto.content);
    } catch {
      throw new BadRequestException(
        this.i18n.t('proposal.content.invalid_json'),
      );
    }

    // Cria a proposta
    const proposal = await this.prisma.proposal.create({
      data: {
        companyId: dto.companyId,
        content: dto.content,
        contentSchemaVersion: dto.contentSchemaVersion || 'v1',
        status: ProposalStatusConst.DRAFT,
      },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'PROPOSAL',
        action: LogActions.CREATE,
        message: `Proposta criada para empresa ${dto.companyId}`,
        metadata: {
          proposalId: proposal.id,
          companyId: proposal.companyId,
          status: proposal.status,
        },
      },
      performedById ?? null,
    );

    return proposal;
  }

  //TODO: OK
  async update(
    id: string,
    dto: UpdateProposalContentDto,
    performedById?: string,
  ): Promise<Proposal> {
    // Verifica se a proposta existe
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
    });

    if (!proposal) {
      throw new NotFoundException(this.i18n.t('proposal.not_found'));
    }

    // Valida se pode editar (apenas DRAFT)
    if (proposal.status !== ProposalStatusConst.DRAFT) {
      throw new BadRequestException(
        this.i18n.t('proposal.cannot_edit_non_draft'),
      );
    }

    // Valida se o content é JSON válido
    try {
      JSON.parse(dto.content);
    } catch {
      throw new BadRequestException(
        this.i18n.t('proposal.content.invalid_json'),
      );
    }

    // Atualiza a proposta
    const updatedProposal = await this.prisma.proposal.update({
      where: { id },
      data: { content: dto.content },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'PROPOSAL',
        action: LogActions.UPDATE,
        message: `Proposta ${id} atualizada`,
        metadata: {
          proposalId: updatedProposal.id,
          companyId: updatedProposal.companyId,
        },
      },
      performedById ?? null,
    );

    return updatedProposal;
  }

  //TODO: OK
  async send(id: string): Promise<Proposal> {
    // Verifica se a proposta existe
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
    });

    if (!proposal) {
      throw new NotFoundException(this.i18n.t('proposal.not_found'));
    }

    // Valida se pode enviar (apenas DRAFT)
    if (proposal.status !== ProposalStatusConst.DRAFT) {
      throw new BadRequestException(
        this.i18n.t('proposal.already_sent_or_approved'),
      );
    }

    // Atualiza o status para SENT
    const updatedProposal = await this.prisma.proposal.update({
      where: { id },
      data: { status: ProposalStatusConst.SENT },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'PROPOSAL',
        action: LogActions.UPDATE,
        message: `Proposta ${id} enviada`,
        metadata: {
          proposalId: updatedProposal.id,
          companyId: updatedProposal.companyId,
          oldStatus: proposal.status,
          newStatus: updatedProposal.status,
        },
      },
      null,
    );

    return updatedProposal;
  }

  //TODO: OK
  async approve(id: string): Promise<Proposal> {
    // Verifica se a proposta existe
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
    });

    if (!proposal) {
      throw new NotFoundException(this.i18n.t('proposal.not_found'));
    }

    // Valida se já está aprovada
    if (proposal.status === ProposalStatusConst.APPROVED) {
      throw new BadRequestException(this.i18n.t('proposal.already_approved'));
    }

    // Atualiza o status para APPROVED
    const updatedProposal = await this.prisma.proposal.update({
      where: { id },
      data: { status: ProposalStatusConst.APPROVED },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'PROPOSAL',
        action: LogActions.UPDATE,
        message: `Proposta ${id} aprovada`,
        metadata: {
          proposalId: updatedProposal.id,
          companyId: updatedProposal.companyId,
          oldStatus: proposal.status,
          newStatus: updatedProposal.status,
        },
      },
      null,
    );

    return updatedProposal;
  }

  //TODO: OK
  async findByCompany(companyId: string): Promise<Proposal[]> {
    return await this.prisma.proposal.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
