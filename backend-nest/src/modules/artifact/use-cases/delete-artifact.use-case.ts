import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import type { Artifact } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { StorageService } from '../../storage/storage.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

interface ArtifactFileEntry {
  path: string;
  contentType: string;
  sizeBytes: number;
}

@Injectable()
export class DeleteArtifactUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly storageService: StorageService,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<Artifact> {
    const artifact = await this.prisma.artifact.findUnique({ where: { id } });
    if (!artifact) {
      throw new NotFoundException(this.i18n.t('artifact.not_found'));
    }

    if (artifact.kind === 'FOLDER') {
      const files = (artifact.files as ArtifactFileEntry[] | null) ?? [];
      await Promise.all(
        files.map((f) =>
          this.storageService.delete(`${artifact.storageKey}${f.path}`),
        ),
      );
    } else {
      await this.storageService.delete(artifact.storageKey);
    }

    await this.prisma.artifact.delete({ where: { id } });

    await this.loggingService.create(
      {
        module: 'ARTIFACT',
        action: LogActions.DELETE,
        message: `Artefato excluído permanentemente: ${artifact.fileName}`,
        metadata: { artifactId: id, kind: artifact.kind },
      },
      user.id,
    );

    return artifact;
  }
}
