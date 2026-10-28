import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaginationQuery } from 'src/common/schemas/pagination.schema';
import { PaginatedResponse } from 'src/common/types/pagination.types';
import { paginate } from 'src/common/utils/paginate.util';
import { LogModule, LogModuleConst } from 'src/domain/logging/logModule.const';
import { LogActions } from 'src/domain/logging/log-actions';
import { Logging } from 'src/domain/logging/logging.entity';

@Injectable()
export class FindAllLogsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<Logging> | Logging[]> {
    const { search, filter } = query;

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

    // Enums inteiros, não os distintos da tabela.
    return paginate(query, {
      findMany: (p) =>
        this.prisma.systemLog.findMany({
          where,
          select,
          orderBy: { createdAt: 'desc' },
          ...p,
        }),
      count: () => this.prisma.systemLog.count({ where }),
      extra: {
        filter: {
          action: Object.values(LogActions),
          module: Object.values(LogModuleConst),
        },
      },
    });
  }
}
