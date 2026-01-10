import { Injectable, NotFoundException } from '@nestjs/common';
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
    user?: { role: string; companyId?: string | null },
  ): Promise<PaginatedResponse<ProjectHistoryDto> | ProjectHistoryDto[]> {
    // 🔒 SECURITY: USER só pode acessar histórico de projetos da própria empresa
    if (user && user.role === 'USER' && user.companyId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { companyId: true },
      });
      if (!project || project.companyId !== user.companyId) {
        throw new NotFoundException('Project not found');
      }
    }
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
