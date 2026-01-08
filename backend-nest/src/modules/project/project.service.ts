import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectDto } from './dto/project.dto';
import type { Project, ProjectStatus } from '@prisma/client';
import { IBaseService } from 'src/domain/interface/base-service.interface';
import {
  PaginatedResponse,
  PaginationParams,
} from 'src/common/types/pagination.types';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/common/types/logging.types';

@Injectable()
export class ProjectService implements IBaseService<
  ProjectDto,
  CreateProjectDto,
  UpdateProjectDto,
  string
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async create(
    createProjectDto: CreateProjectDto,
    performedById: string,
  ): Promise<ProjectDto> {
    // Verifica se a company existe
    const company = await this.prisma.company.findUnique({
      where: { id: createProjectDto.companyId },
    });

    if (!company) {
      throw new NotFoundException(
        this.i18n.t('project.errors.company_not_found') || 'Company not found',
      );
    }

    // Se proposalId foi fornecido, verifica se existe
    if (createProjectDto.proposalId) {
      const proposal = await this.prisma.proposal.findUnique({
        where: { id: createProjectDto.proposalId },
      });

      if (!proposal) {
        throw new NotFoundException(
          this.i18n.t('project.errors.proposal_not_found') ||
            'Proposal not found',
        );
      }
    }

    const project = await this.prisma.project.create({
      data: {
        companyId: createProjectDto.companyId,
        proposalId: createProjectDto.proposalId || null,
        name: createProjectDto.name,
        description: createProjectDto.description || null,
        status: createProjectDto.status || 'PROPOSAL',
      },
    });

    // Registra histórico de criação
    await this.prisma.projectHistory.create({
      data: {
        projectId: project.id,
        type: 'STATUS_CHANGE',
        payload: JSON.stringify({
          oldStatus: null,
          newStatus: project.status,
          action: 'CREATE',
        }),
      },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'PROJECT',
        action: LogActions.CREATE,
        message: `Project ${project.name} created`,
        metadata: {
          projectId: project.id,
          companyId: project.companyId,
          name: project.name,
          status: project.status,
        },
      },
      performedById,
    );

    return this.mapToDto(project);
  }

  async findAll(
    params?: PaginationParams,
  ): Promise<PaginatedResponse<ProjectDto> | ProjectDto[]> {
    const { page, limit, pagination, search, filter } = params || {
      page: 1,
      limit: 10,
      pagination: true,
    };

    const where: {
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' };
        description?: { contains: string; mode: 'insensitive' };
      }>;
      companyId?: string | { in: string[] };
      status?: import('@prisma/client').ProjectStatus;
    } = {};

    // Busca por texto (name ou description)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filtro por companyName
    if (filter?.companyName) {
      // Busca empresas que contenham o nome informado
      const companies = await this.prisma.company.findMany({
        where: {
          name: { contains: filter.companyName, mode: 'insensitive' },
        },
        select: { id: true },
      });
      const companyIds = companies.map((c) => c.id);
      if (companyIds.length > 0) {
        where.companyId = { in: companyIds };
      } else {
        // Se não encontrou nenhuma empresa, retorna vazio
        if (pagination) {
          return {
            data: [],
            meta: { total: 0, page, limit, totalPages: 0 },
            filter: { status: [], companyName: [] },
          };
        }
        return [];
      }
    }

    // Filtro por status
    if (filter?.status) {
      // Garante que status seja do tipo enum do Prisma
      where.status = filter.status as ProjectStatus;
    }

    const select = {
      id: true,
      companyId: true,
      proposalId: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      company: {
        select: {
          name: true,
        },
      },
    };

    if (!pagination) {
      const projects = await this.prisma.project.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
      });
      return projects.map((project) => {
        const { company, ...projectData } = project;
        return {
          ...this.mapToDto(projectData as Project),
          companyName: company?.name || null,
        };
      });
    }

    const skip = (page - 1) * limit;
    const [projects, total, statusValues, companyValues] = await Promise.all([
      this.prisma.project.findMany({
        where,
        select,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({ select: { status: true } }),
      this.prisma.project.findMany({ select: { companyId: true } }),
    ]);

    // Extrai valores únicos para filtros
    const statusSet = Array.from(new Set(statusValues.map((p) => p.status)));
    const companyIds = Array.from(
      new Set(companyValues.map((p) => p.companyId)),
    );

    // Buscar nomes das empresas únicas
    const companies = await this.prisma.company.findMany({
      where: { id: { in: companyIds } },
      select: { name: true },
    });
    const companyNameSet = companies.map((c) => c.name);

    return {
      data: projects.map((project) => {
        const { company, ...projectData } = project;
        return {
          ...this.mapToDto(projectData as Project),
          companyName: company?.name || null,
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      filter: {
        status: statusSet,
        companyName: companyNameSet,
      },
    };
  }

  async findOne(id: string): Promise<ProjectDto> {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException(
        this.i18n.t('project.errors.not_found') || 'Project not found',
      );
    }

    return this.mapToDto(project);
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
    performedById: string,
  ): Promise<ProjectDto> {
    const existing = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(
        this.i18n.t('project.errors.not_found') || 'Project not found',
      );
    }

    // Se proposalId foi fornecido, verifica se existe
    if (updateProjectDto.proposalId) {
      const proposal = await this.prisma.proposal.findUnique({
        where: { id: updateProjectDto.proposalId },
      });

      if (!proposal) {
        throw new NotFoundException(
          this.i18n.t('project.errors.proposal_not_found') ||
            'Proposal not found',
        );
      }
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: updateProjectDto,
    });

    // Se o status mudou, registra no histórico
    if (
      updateProjectDto.status &&
      updateProjectDto.status !== existing.status
    ) {
      await this.prisma.projectHistory.create({
        data: {
          projectId: project.id,
          type: 'STATUS_CHANGE',
          payload: JSON.stringify({
            oldStatus: existing.status,
            newStatus: project.status,
            changedBy: performedById,
          }),
        },
      });
    }

    // Log da ação
    await this.loggingService.create(
      {
        module: 'PROJECT',
        action: LogActions.UPDATE,
        message: `Project ${project.name} updated`,
        metadata: {
          projectId: project.id,
          changes: updateProjectDto,
        },
      },
      performedById,
    );

    return this.mapToDto(project);
  }

  async remove(
    performedById: string,
    id: string,
  ): Promise<{ status: boolean; message: string }> {
    const existing = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(
        this.i18n.t('project.errors.not_found') || 'Project not found',
      );
    }

    await this.prisma.project.delete({
      where: { id },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'PROJECT',
        action: LogActions.DELETE,
        message: `Project ${existing.name} deleted`,
        metadata: {
          projectId: existing.id,
          name: existing.name,
        },
      },
      performedById,
    );

    return {
      status: true,
      message:
        this.i18n.t('project.success.deleted') ||
        'Project deleted successfully',
    };
  }

  private mapToDto(project: Project): ProjectDto {
    return new ProjectDto(project);
  }
}
