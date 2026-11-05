import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginationQuery } from '../../../common/schemas/pagination.schema';
import { paginate } from '../../../common/utils/paginate.util';
import type { Prisma } from '@prisma/client';

@Injectable()
export class ListCompanyMembersUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(companyId: string, query: PaginationQuery) {
    const { search } = query;

    const where: Prisma.MembershipWhereInput = { companyId };

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const include = {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          imageUrl: true,
          roleRecord: { select: { name: true } },
        },
      },
    };

    return paginate(query, {
      findMany: (p) =>
        this.prisma.membership.findMany({
          where,
          include,
          orderBy: { createdAt: 'desc' },
          ...p,
        }),
      count: () => this.prisma.membership.count({ where }),
    });
  }
}
