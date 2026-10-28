import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginationQuery } from '../../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../../common/types/pagination.types';
import { paginate } from '../../../common/utils/paginate.util';

// Projeção da listagem: sem mensagens e sem estado de aprovação, que vivem no checkpoint.
export interface AiConversationSummary {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ListConversationsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: PaginationQuery,
    userId: string,
  ): Promise<
    PaginatedResponse<AiConversationSummary> | AiConversationSummary[]
  > {
    const { search } = query;

    const where: {
      userId: string;
      OR?: Array<{ title?: { contains: string } }>;
    } = { userId };

    if (search) {
      where.OR = [{ title: { contains: search } }];
    }

    const select = {
      id: true,
      userId: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    };

    return paginate(query, {
      findMany: (p) =>
        this.prisma.aiConversation.findMany({
          where,
          select,
          orderBy: { updatedAt: 'desc' },
          ...p,
        }),
      count: () => this.prisma.aiConversation.count({ where }),
    });
  }
}
