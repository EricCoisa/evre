import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { LoggingService } from '../logging/logging.service';
import { ContractDocument } from 'src/domain/contract-document/contract-document.entity';
import { CreateContractDocumentDto } from './dto/create-contract-document.dto';
import { UpdateContractDocumentContentDto } from './dto/update-contract-document-content.dto';
import { ContractStatusConst } from 'src/domain/contract-document/contractStatus.const';
import { LogActions } from '../../common/types/logging.types';
import { IBaseService } from 'src/domain/interface/base-service.interface';
import type { PaginationQuery } from '../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import { ContractStatus } from '@prisma/client';

@Injectable()
export class ContractDocumentService implements Omit<
  IBaseService<ContractDocument>,
  'remove'
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async findAll(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<ContractDocument> | ContractDocument[]> {
    const { page, limit, pagination, search, filter } = query;

    const where: {
      OR?: Array<{
        name?: { contains: string };
        projectId?: { contains: string };
        project?: { company?: { name?: { contains: string } } };
      }>;
      status?: ContractStatus;
      projectId?: string;
      project?: { companyId?: string; company?: { name?: string } };
    } = {};

    // Aplica filtro de busca global (search)
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { projectId: { contains: search } },
        { project: { company: { name: { contains: search } } } },
      ];
    }

    // Aplica filtros específicos (filter)
    if (filter?.status) {
      where.status = filter.status as ContractStatus;
    }

    if (filter?.projectId) {
      where.projectId = filter.projectId;
    }

    if (filter?.companies) {
      // Busca contratos cujos projetos pertencem à empresa exata
      where.project = { company: { name: filter.companies } };
    }

    if (!pagination) {
      const data = await this.prisma.contractDocument.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      return data;
    }

    // Com paginação
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.contractDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contractDocument.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const statusSet = Object.values(ContractStatusConst);

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
        companies: (await this.prisma.company.findMany()).map(
          (company) => company.name,
        ),
      },
    };
  }

  async findOne(id: string): Promise<ContractDocument> {
    const contract = await this.prisma.contractDocument.findUnique({
      where: { id },
    });

    if (!contract) {
      throw new NotFoundException(
        this.i18n.t('contract_document.errors.not_found'),
      );
    }

    return contract;
  }

  async create(
    dto: CreateContractDocumentDto,
    performedById?: string,
  ): Promise<ContractDocument> {
    // Valida se o project existe
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(this.i18n.t('project.errors.not_found'));
    }

    // Valida se a proposal existe (se informada)
    if (dto.proposalId) {
      const proposal = await this.prisma.proposal.findUnique({
        where: { id: dto.proposalId },
      });

      if (!proposal) {
        throw new NotFoundException(this.i18n.t('proposal.errors.not_found'));
      }
    }

    // Valida se o content é JSON válido
    try {
      JSON.parse(dto.content);
    } catch {
      throw new BadRequestException(
        this.i18n.t('contract_document.errors.invalid_json_content'),
      );
    }

    // Cria o contrato
    const contract = await this.prisma.contractDocument.create({
      data: {
        projectId: dto.projectId,
        proposalId: dto.proposalId || null,
        name: dto.name,
        content: dto.content,
        contentSchemaVersion: dto.contentSchemaVersion || 'v1',
        status: ContractStatusConst.DRAFT,
        version: 1,
      },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'CONTRACT_DOCUMENT',
        action: LogActions.CREATE,
        message: `Contrato criado para projeto ${dto.projectId}`,
        metadata: {
          contractId: contract.id,
          projectId: contract.projectId,
          status: contract.status,
        },
      },
      performedById ?? null,
    );

    return contract;
  }

  async update(
    id: string,
    dto: UpdateContractDocumentContentDto,
    performedById?: string,
  ): Promise<ContractDocument> {
    const contract = await this.findOne(id);

    // Apenas contratos em DRAFT podem ser editados
    if (contract.status !== ContractStatusConst.DRAFT) {
      throw new BadRequestException(
        this.i18n.t('contract_document.errors.cannot_edit_non_draft'),
      );
    }

    // Valida se o content é JSON válido
    try {
      JSON.parse(dto.content);
    } catch {
      throw new BadRequestException(
        this.i18n.t('contract_document.errors.invalid_json_content'),
      );
    }

    const updated = await this.prisma.contractDocument.update({
      where: { id },
      data: {
        name: dto.name,
        content: dto.content,
      },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'CONTRACT_DOCUMENT',
        action: LogActions.UPDATE,
        message: `Contrato ${id} atualizado`,
        metadata: {
          contractId: updated.id,
          changes: dto,
        },
      },
      performedById ?? null,
    );

    return updated;
  }

  async send(id: string, performedById?: string): Promise<ContractDocument> {
    const contract = await this.findOne(id);

    if (contract.status !== ContractStatusConst.DRAFT) {
      throw new BadRequestException(
        this.i18n.t('contract_document.errors.already_sent'),
      );
    }

    const updated = await this.prisma.contractDocument.update({
      where: { id },
      data: { status: ContractStatusConst.SENT },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'CONTRACT_DOCUMENT',
        action: LogActions.UPDATE,
        message: `Contrato ${id} enviado`,
        metadata: {
          contractId: updated.id,
          oldStatus: contract.status,
          newStatus: updated.status,
        },
      },
      performedById ?? null,
    );

    return updated;
  }

  async accept(id: string, performedById?: string): Promise<ContractDocument> {
    const contract = await this.findOne(id);

    if (contract.status !== ContractStatusConst.SENT) {
      throw new BadRequestException(
        this.i18n.t('contract_document.errors.cannot_accept'),
      );
    }

    const updated = await this.prisma.contractDocument.update({
      where: { id },
      data: { status: ContractStatusConst.ACCEPTED },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'CONTRACT_DOCUMENT',
        action: LogActions.UPDATE,
        message: `Contrato ${id} aceito`,
        metadata: {
          contractId: updated.id,
          oldStatus: contract.status,
          newStatus: updated.status,
        },
      },
      performedById ?? null,
    );

    return updated;
  }

  async archive(id: string, performedById?: string): Promise<ContractDocument> {
    const contract = await this.findOne(id);

    const updated = await this.prisma.contractDocument.update({
      where: { id },
      data: { status: ContractStatusConst.ARCHIVED },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'CONTRACT_DOCUMENT',
        action: LogActions.UPDATE,
        message: `Contrato ${id} arquivado`,
        metadata: {
          contractId: updated.id,
          oldStatus: contract.status,
          newStatus: updated.status,
        },
      },
      performedById ?? null,
    );

    return updated;
  }

  async findByProject(projectId: string): Promise<ContractDocument[]> {
    return await this.prisma.contractDocument.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
