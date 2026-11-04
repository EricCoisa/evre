import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { resolveArtifactViewKey } from './resolve-artifact-view-key.util';

/** Preview autenticado (editor) — ignora `published`, só exige o artefato existir e não estar
 * arquivado. Devolve a presigned URL do arquivo (ou da entrada da pasta) a redirecionar. */
@Injectable()
export class ViewArtifactUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly storageService: StorageService,
  ) {}

  async execute(id: string, subPath: string | undefined): Promise<string> {
    const artifact = await this.prisma.artifact.findUnique({ where: { id } });
    if (!artifact || artifact.archivedAt) {
      throw new NotFoundException(this.i18n.t('artifact.not_found'));
    }

    const key = resolveArtifactViewKey(artifact, subPath, this.i18n);
    return this.storageService.getPresignedUrl(key);
  }
}
