import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginationQuery } from '../../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../../common/types/pagination.types';
import { paginate } from '../../../common/utils/paginate.util';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { Proposal } from 'src/domain/proposal/proposal.entity';

export type ProposalListItem = Proposal & {
  daysWithoutMovement: number;
  companyName: string | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class FindAllProposalUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: PaginationQuery,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<ProposalListItem> | ProposalListItem[]> {
    const { search, filter } = query;

    const and: Prisma.ProposalWhereInput[] = [];
    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { company: { name: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }
    if (filter?.companyId) {
      and.push({ companyId: filter.companyId });
    }

    if (user.roleName !== 'ADMIN') {
      const memberships = await this.prisma.membership.findMany({
        where: { userId: user.id, canSeeCommercials: true },
        select: { companyId: true },
      });
      const companyIds = memberships
        .map((m) => m.companyId)
        .filter((id): id is string => id !== null);
      and.push({
        OR: [{ companyId: { in: companyIds } }, { companyId: null }],
      });
    }

    const where: Prisma.ProposalWhereInput = {
      archivedAt: null,
      ...(and.length ? { AND: and } : {}),
    };

    return paginate(query, {
      findMany: (p) =>
        this.prisma.proposal.findMany({
          where,
          include: { company: { select: { name: true } } },
          // Ordem padrão da tela: mais dias sem movimento primeiro — o inverso de updatedAt desc.
          orderBy: { updatedAt: 'asc' },
          ...p,
        }),
      count: () => this.prisma.proposal.count({ where }),
      map: (row) => {
        const { company, ...rest } = row;
        return {
          ...rest,
          companyName: company?.name ?? null,
          daysWithoutMovement: Math.floor(
            (Date.now() - row.updatedAt.getTime()) / MS_PER_DAY,
          ),
        } as unknown as ProposalListItem;
      },
    });
  }
}
