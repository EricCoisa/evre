import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import type { Artifact } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

/** Arquiva um artefato; nunca apaga a linha nem a key no storage — uma `ProposalVersion` (ou
 * qualquer outro consumidor) publicada pode continuar apontando para ela. */
@Injectable()
export class ArchiveArtifactUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<Artifact> {
    const found = await this.prisma.artifact.findUnique({ where: { id } });
    if (!found) {
      throw new NotFoundException(this.i18n.t('artifact.not_found'));
    }

    const archived = found.archivedAt
      ? found
      : await this.prisma.artifact.update({
          where: { id },
          data: { archivedAt: new Date() },
        });

    if (!found.archivedAt) {
      await this.loggingService.create(
        {
          module: 'ARTIFACT',
          action: LogActions.ARCHIVE,
          message: `Artefato arquivado: ${found.fileName}`,
          metadata: { artifactId: id },
        },
        user.id,
      );
    }

    return archived;
  }
}
