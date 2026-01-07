import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyDto } from './dto/company.dto';
import type { Company, CompanyStatus } from '@prisma/client';
import { IBaseService } from 'src/domain/interface/base-service.interface';
import {
  PaginatedResponse,
  PaginationParams,
} from 'src/common/types/pagination.types';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/common/types/logging.types';
import { CompanyStatusConst } from '../../domain/company/companyStatus.const';

@Injectable()
export class CompanyService implements IBaseService<
  CompanyDto,
  CreateCompanyDto,
  UpdateCompanyDto,
  string
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async create(
    createCompanyDto: CreateCompanyDto,
    performedById: string,
  ): Promise<CompanyDto> {
    // Verifica se já existe empresa com o mesmo nome (case-insensitive)
    const existing = await this.prisma.company.findFirst({
      where: {
        name: { equals: createCompanyDto.name, mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new ConflictException(
        this.i18n.t('company.errors.duplicate_name') ||
          `Já existe uma empresa com o nome "${createCompanyDto.name}".`,
      );
    }

    const company = await this.prisma.company.create({
      data: {
        name: createCompanyDto.name,
        status: 'DRAFT', // Status inicial sempre DRAFT
      },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'COMPANY',
        action: LogActions.CREATE,
        message: `Empresa ${company.name} criada`,
        metadata: {
          companyId: company.id,
          name: company.name,
          status: company.status,
        },
      },
      performedById,
    );

    return this.mapToDto(company);
  }

  async findAll(
    params?: PaginationParams,
  ): Promise<PaginatedResponse<CompanyDto> | CompanyDto[]> {
    const { page, limit, pagination, search, filter } = params || {
      page: 1,
      limit: 10,
      pagination: false,
    };

    const where: {
      OR?: Array<{
        name?: { contains: string };
      }>;
      status?: CompanyStatus;
    } = {};

    if (search) {
      where.OR = [{ name: { contains: search } }];
    }

    if (filter?.status) {
      where.status = filter.status as CompanyStatus;
    }

    if (!pagination) {
      const companies = await this.prisma.company.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      return companies.map((company) => this.mapToDto(company));
    }

    const skip = (page - 1) * limit;

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.company.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const statusSet = Object.values(CompanyStatusConst);

    return {
      data: companies.map((company) => this.mapToDto(company)),
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

  async findOne(...pk: unknown[]): Promise<CompanyDto | null> {
    const id = pk[0] as string;
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      return null;
    }

    return this.mapToDto(company);
  }

  async update(
    id: string,
    updateCompanyDto: UpdateCompanyDto,
    performedById: string,
  ): Promise<CompanyDto> {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException(
        this.i18n.t('common.errors.notFound', {
          args: { entity: 'Company' },
        }),
      );
    }

    const updatedCompany = await this.prisma.company.update({
      where: { id },
      data: {
        ...(updateCompanyDto.name && { name: updateCompanyDto.name }),
        ...(updateCompanyDto.status && { status: updateCompanyDto.status }),
      },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'COMPANY',
        action: LogActions.UPDATE,
        message: `Empresa ${updatedCompany.name} atualizada`,
        metadata: {
          companyId: updatedCompany.id,
          oldName: company.name,
          newName: updatedCompany.name,
          oldStatus: company.status,
          newStatus: updatedCompany.status,
        },
      },
      performedById,
    );

    return this.mapToDto(updatedCompany);
  }

  async remove(
    performedById: string,
    ...pk: unknown[]
  ): Promise<{ status: boolean; message: string }> {
    const id = pk[0] as string;
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException(
        this.i18n.t('common.errors.notFound', {
          args: { entity: 'Company' },
        }),
      );
    }

    await this.prisma.company.delete({
      where: { id },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'COMPANY',
        action: LogActions.DELETE,
        message: `Empresa ${company.name} removida`,
        metadata: {
          companyId: company.id,
          name: company.name,
          status: company.status,
        },
      },
      performedById,
    );

    return {
      status: true,
      message: this.i18n.t('common.success.deleted', {
        args: { entity: 'Company' },
      }),
    };
  }

  private mapToDto(company: Company): CompanyDto {
    return {
      id: company.id,
      name: company.name,
      status: company.status,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }
}
