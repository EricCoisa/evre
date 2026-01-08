import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectHistoryDto } from './dto/project-history.dto';

@Injectable()
export class ProjectHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProject(projectId: string): Promise<ProjectHistoryDto[]> {
    const histories = await this.prisma.projectHistory.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return histories.map((h) => new ProjectHistoryDto(h));
  }
}
