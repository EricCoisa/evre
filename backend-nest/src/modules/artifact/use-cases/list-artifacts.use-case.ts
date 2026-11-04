import { Injectable } from '@nestjs/common';
import type { Artifact } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaginationQuery } from 'src/common/schemas/pagination.schema';
import { PaginatedResponse } from 'src/common/types/pagination.types';
import { paginate } from 'src/common/utils/paginate.util';

/** Lista artefatos ativos (não arquivados), globais — não escopados a nenhuma feature. */
@Injectable()
export class ListArtifactsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<Artifact> | Artifact[]> {
    const { search } = query;
    const where = {
      archivedAt: null,
      ...(search
        ? { fileName: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    return paginate(query, {
      findMany: (p) =>
        this.prisma.artifact.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...p,
        }),
      count: () => this.prisma.artifact.count({ where }),
    });
  }
}
