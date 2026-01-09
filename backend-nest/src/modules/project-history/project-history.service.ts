import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectHistoryDto } from './dto/project-history.dto';
import type { PaginationQuery } from '../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../common/types/pagination.types';

@Injectable()
export class ProjectHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProject(
    projectId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<ProjectHistoryDto> | ProjectHistoryDto[]> {
    const { page, limit, pagination } = query;

    if (!pagination) {
      const histories = await this.prisma.projectHistory.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });
      return histories.map((h) => new ProjectHistoryDto(h));
    }

    const skip = (page - 1) * limit;
    const [histories, total] = await Promise.all([
      this.prisma.projectHistory.findMany({
        where: { projectId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.projectHistory.count({ where: { projectId } }),
    ]);

    return {
      data: histories.map((h) => new ProjectHistoryDto(h)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
