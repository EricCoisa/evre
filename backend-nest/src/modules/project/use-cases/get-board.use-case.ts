import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindOneProjectUseCase } from './find-one.use-case';

@Injectable()
export class GetBoardUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly findOne: FindOneProjectUseCase,
  ) {}

  async execute(projectId: string, user: AuthenticatedUser) {
    await this.findOne.execute(projectId, user);

    return this.prisma.projectMilestone.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
      include: {
        tasks: {
          orderBy: { position: 'asc' },
          include: {
            assignee: {
              select: { id: true, name: true, email: true, imageUrl: true },
            },
          },
        },
      },
    });
  }
}
