import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

import { PaginationQuery } from 'src/common/schemas/pagination.schema';
import { PaginatedResponse } from 'src/common/types/pagination.types';
import { LogModule, LogModuleConst } from 'src/domain/logging/logModule.const';
import { LogActions } from 'src/common/types/logging.types';
import { CreateLogParams } from './dto/create-logging-dto';
import { Logging } from 'src/domain/logging/logging.entity';
import { IBaseService } from 'src/domain/interface/base-service.interface';

@Injectable()
export class LoggingService implements Omit<
  IBaseService<Logging>,
  'update' | 'remove'
> {
  constructor(private readonly prisma: PrismaService) {}

  //TODO: OK
  async findAll(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<Logging> | Logging[]> {
    const { page, limit, pagination, search, filter } = query;

    // Constrói a cláusula where separando search e filter
    const where: {
      OR?: Array<{
        action?: { contains: string };
        message?: { contains: string };
        performedBy?: {
          name?: { contains: string };
          email?: { contains: string };
        };
      }>;
      action?: string;
      module?: LogModule;
    } = {};

    // Aplica filtro de busca global (search)
    if (search) {
      where.OR = [
        { action: { contains: search } },
        { message: { contains: search } },
        { performedBy: { name: { contains: search } } },
        { performedBy: { email: { contains: search } } },
      ];
    }

    // Aplica filtros específicos (filter)
    if (filter?.action) {
      where.action = filter.action;
    }

    if (filter?.module) {
      where.module = filter.module as LogModule;
    }

    const select = {
      id: true,
      module: true,
      action: true,
      message: true,
      metadata: true,
      performedById: true,
      createdAt: true,
      performedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    };

    if (!pagination) {
      // Retorna todos os usuários sem paginação
      return await this.prisma.systemLog.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
      });
    }

    // Com paginação
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.systemLog.findMany({
        where,
        select,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.systemLog.count({ where }),
      this.prisma.systemLog.findMany({
        where,
        select: { action: true, module: true },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Extrai valores únicos de action e module
    const actionsSet = Object.values(LogActions);
    const modulesSet = Object.values(LogModuleConst);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
      filter: {
        action: Array.from(actionsSet),
        module: Array.from(modulesSet),
      },
    };
  }

  //TODO: OK
  async findOne(id: string): Promise<Logging | null> {
    return await this.prisma.systemLog.findUnique({
      where: { id },
    });
  }

  //TODO: OK
  async create(
    data: CreateLogParams,
    performedById: null | string,
  ): Promise<Logging> {
    return await this.prisma.systemLog.create({
      data: {
        module: data.module,
        action: data.action,
        message: data.message,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        performedById: performedById,
      },
    });
  }
}
