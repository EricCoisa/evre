import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

import { PaginationQuery } from 'src/common/schemas/pagination.schema';
import { PaginatedResponse } from 'src/common/types/pagination.types';
import { CreateClientLogDto } from './dto/create-clientLog-dto';
import { ClientLog } from 'src/domain/clientLog/clientLog.entity';
import { ClientLogDto } from './dto/clientLog-dto';

@Injectable()
export class ClientLogService {
  constructor(private readonly prisma: PrismaService) {}

  //TODO: OK
  async findAll(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<ClientLogDto> | ClientLogDto[]> {
    const { page, limit, pagination, search, filter } = query;

    // Constrói a cláusula where separando search e filter
    const where: {
      OR?: Array<{
        environment?: { contains: string };
        metadata?: { contains: string };
      }>;
      companyId?: string;
      projectId?: string;
      environment?: string;
    } = {};

    // Busca global
    if (search) {
      where.OR = [
        { environment: { contains: search } },
        { metadata: { contains: search } },
      ];
    }

    // Filtros específicos
    if (filter?.companyId) {
      where.companyId = filter.companyId;
    }
    if (filter?.projectId) {
      where.projectId = filter.projectId;
    }
    if (filter?.environment) {
      where.environment = filter.environment;
    }

    const select = {
      id: true,
      companyId: true,
      projectId: true,
      environment: true,
      metadata: true,
      createdAt: true,
      company: {
        select: {
          name: true,
        },
      },
      project: {
        select: {
          name: true,
        },
      },
    };

    type ClientLogWithRelations = {
      id: string;
      companyId: string;
      projectId: string;
      environment: string;
      metadata: string | null;
      createdAt: Date;
      company: { name: string };
      project: { name: string };
    };

    const mapToDto = (log: ClientLogWithRelations): ClientLogDto => ({
      id: log.id,
      companyId: log.companyId,
      companyName: log.company.name,
      projectId: log.projectId,
      projectName: log.project.name,
      environment: log.environment,
      metadata: log.metadata,
      createdAt: log.createdAt,
    });

    if (!pagination) {
      const logs = await this.prisma.clientLog.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
      });
      return logs.map(mapToDto);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.clientLog.findMany({
        where,
        select,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.clientLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: logs.map(mapToDto),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  //TODO: OK
  async findOne(id: string): Promise<ClientLog | null> {
    return await this.prisma.clientLog.findUnique({
      where: { id },
    });
  }

  //TODO: OK
  async create(
    data: CreateClientLogDto,
    projectId: string,
    companyId: string,
  ): Promise<ClientLog> {
    return await this.prisma.clientLog.create({
      data: {
        companyId,
        projectId,
        environment: data.environment,
        metadata: data.metadata || null,
      },
    });
  }
}
