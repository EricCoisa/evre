import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindOneProjectUseCase } from './find-one.use-case';

@Injectable()
export class RemoveProjectUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly findOne: FindOneProjectUseCase,
  ) {}

  async execute(id: string, user: AuthenticatedUser) {
    const found = await this.findOne.execute(id, user);

    const archived = found.archivedAt
      ? found
      : await this.prisma.project.update({
          where: { id },
          data: { archivedAt: new Date(), status: 'ARCHIVED' },
        });

    if (!found.archivedAt) {
      await this.loggingService.create(
        {
          module: 'PROJECT',
          action: LogActions.ARCHIVE,
          message: `Project arquivado: ${found.name}`,
          metadata: { projectId: id },
        },
        user.id,
      );
    }

    return archived;
  }
}
