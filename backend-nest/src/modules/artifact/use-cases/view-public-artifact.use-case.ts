import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { resolveArtifactViewKey } from './resolve-artifact-view-key.util';

/** Resolve por `publicToken`, nunca por id interno — só libera se `published && !archivedAt`.
 * Despublicar/arquivar derruba o acesso na hora, porque a permissão fica na tabela, nunca em ACL
 * de bucket (ver docs/backend/storage.md). */
@Injectable()
export class ViewPublicArtifactUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly storageService: StorageService,
  ) {}

  async execute(token: string, subPath: string | undefined): Promise<string> {
    const artifact = await this.prisma.artifact.findUnique({
      where: { publicToken: token },
    });
    if (!artifact || !artifact.published || artifact.archivedAt) {
      throw new NotFoundException(this.i18n.t('artifact.not_found'));
    }

    const key = resolveArtifactViewKey(artifact, subPath, this.i18n);
    return this.storageService.getPresignedUrl(key);
  }
}
