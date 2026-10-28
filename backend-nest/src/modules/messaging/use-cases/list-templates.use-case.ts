import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { PaginationQuery } from 'src/common/schemas/pagination.schema';
import type { PaginatedResponse } from 'src/common/types/pagination.types';
import { paginate } from 'src/common/utils/paginate.util';
import type { MessagingTemplateDto } from '../dto/messaging-template.dto';
import { MessagingTemplateCategory } from '@prisma/client';

export interface ListTemplatesQuery extends PaginationQuery {
  typeId?: string;
  /** Presente = cada template sai com `approvalStatus` calculado para ESTA conexão. */
  connectionId?: string;
}

@Injectable()
export class ListTemplatesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ListTemplatesQuery,
  ): Promise<PaginatedResponse<MessagingTemplateDto> | MessagingTemplateDto[]> {
    const where: {
      typeId?: string;
      OR?: Array<{ key?: { contains: string } }>;
      category?: MessagingTemplateCategory;
    } = query.typeId ? { typeId: query.typeId } : {};
    const { connectionId, search, filter } = query;

    if (search) {
      where.OR = [{ key: { contains: search } }];
    }

    if (filter?.category) {
      where.category = filter.category as MessagingTemplateCategory;
    }

    return paginate(query, {
      findMany: (p) =>
        this.prisma.messagingTemplate.findMany({
          where,
          orderBy: [{ key: 'asc' }, { language: 'asc' }],
          include: {
            submissions: connectionId ? { where: { connectionId } } : true,
          },
          ...p,
        }),
      count: () => this.prisma.messagingTemplate.count({ where }),
      map: (row) => {
        const { submissions, ...rest } = row;
        return {
          ...rest,
          approvalStatus: connectionId
            ? (submissions[0]?.status ?? null)
            : undefined,
          submissions: submissions.map((s) => ({
            connectionId: s.connectionId,
            status: s.status,
            reason: s.reason,
            reviewedAt: s.reviewedAt,
            submittedAt: s.submittedAt,
            outOfSync: s.outOfSync,
          })),
        } as unknown as MessagingTemplateDto;
      },
      extra: {
        filter: {
          category: Object.values(MessagingTemplateCategory),
        },
      },
    });
  }
}
