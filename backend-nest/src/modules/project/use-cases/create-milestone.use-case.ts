import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { CreateMilestoneDto } from '../dto/create-milestone.dto';
import { FindOneProjectUseCase } from './find-one.use-case';

@Injectable()
export class CreateMilestoneUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly findOne: FindOneProjectUseCase,
  ) {}

  async execute(
    projectId: string,
    dto: CreateMilestoneDto,
    user: AuthenticatedUser,
  ) {
    await this.findOne.execute(projectId, user);

    const maxPos = await this.prisma.projectMilestone.aggregate({
      where: { projectId },
      _max: { position: true },
    });

    const created = await this.prisma.projectMilestone.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description,
        position: (maxPos._max.position ?? -1) + 1,
      },
    });

    await this.loggingService.create(
      {
        module: 'PROJECT',
        action: LogActions.CREATE,
        message: `Milestone criada: ${created.title}`,
        metadata: { projectId, milestoneId: created.id },
      },
      user.id,
    );

    return created;
  }
}
