import { Injectable } from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { paginate } from '../../../common/utils/paginate.util';
import type { PaginationQuery } from '../../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../../common/types/pagination.types';
import type { Prisma } from '@prisma/client';
import type { Lead } from 'src/domain/lead/lead.entity';

@Injectable()
export class ListLeadsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<Lead> | Lead[]> {
    const { search, filter } = query;

    const where: Prisma.LeadWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const rawStatus = filter?.status;
    if (rawStatus && Object.values(LeadStatus).includes(rawStatus as LeadStatus)) {
      where.status = rawStatus as LeadStatus;
    }

    return paginate(query, {
      findMany: (p) =>
        this.prisma.lead.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...p,
        }),
      count: () => this.prisma.lead.count({ where }),
      extra: { filter: { status: ['NEW', 'VIEWED', 'RESOLVED'] } },
    });
  }
}
