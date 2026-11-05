import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { UpdateProjectDto } from '../dto/update-project.dto';
import { FindOneProjectUseCase } from './find-one.use-case';

@Injectable()
export class UpdateProjectUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly findOne: FindOneProjectUseCase,
  ) {}

  async execute(id: string, dto: UpdateProjectDto, user: AuthenticatedUser) {
    await this.findOne.execute(id, user);

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.status === 'ARCHIVED' ? { archivedAt: new Date() } : {}),
      },
    });

    await this.loggingService.create(
      {
        module: 'PROJECT',
        action: LogActions.UPDATE,
        message: `Project atualizado: ${updated.name}`,
        metadata: { projectId: id },
      },
      user.id,
    );

    return updated;
  }
}
