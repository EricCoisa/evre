import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindOneProjectUseCase } from './find-one.use-case';

@Injectable()
export class GetProjectMembersUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly findOne: FindOneProjectUseCase,
  ) {}

  async execute(projectId: string, user: AuthenticatedUser) {
    await this.findOne.execute(projectId, user);

    const memberships = await this.prisma.membership.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, email: true, imageUrl: true } },
      },
    });

    return memberships.map((m) => m.user);
  }
}
