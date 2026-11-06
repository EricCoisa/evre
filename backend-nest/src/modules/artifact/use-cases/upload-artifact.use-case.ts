import { BadRequestException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { posix } from 'node:path';
import * as unzipper from 'unzipper';
import type { Artifact, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { StorageService } from '../../storage/storage.service';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import {
  ARTIFACT_CONFIG_KEYS,
  ARTIFACT_CONTENT_TYPES_BY_EXTENSION,
  ARTIFACT_DEFAULT_ENTRY_FILE_NAME,
  ARTIFACT_FILE_DEFAULT_MAX_SIZE_BYTES,
  ARTIFACT_FILE_MIME_TYPES,
  ARTIFACT_FOLDER_DEFAULT_MAX_SIZE_BYTES,
  ARTIFACT_ZIP_DEFAULT_MAX_SIZE_BYTES,
  ARTIFACT_ZIP_IGNORED_ENTRIES,
  ARTIFACT_ZIP_MIME_TYPES,
  type ArtifactExtension,
} from 'src/domain/artifact/artifact.const';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

export interface UploadArtifactFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

interface ArtifactManifestEntry {
  path: string;
  contentType: string;
  sizeBytes: number;
}

/** Normaliza o path de uma entrada de zip, rejeitando o que resolveria fora do prefixo de
 * destino: `..`, path absoluto ou separador nulo. É isso que fecha path traversal na extração. */
function normalizeZipEntryPath(rawPath: string): string | null {
  if (rawPath.includes('\0')) return null;
  const unixPath = rawPath.replace(/\\/g, '/');
  if (unixPath.startsWith('/')) return null;
  const normalized = posix.normalize(unixPath);
  if (
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.startsWith('/')
  ) {
    return null;
  }
  return normalized;
}

/** Se todas as entradas do zip compartilham um prefixo de diretório comum (pasta wrapper gerada
 * quando o usuário comprime "a pasta" em vez de "o conteúdo da pasta"), devolve o prefixo para
 * strip — ex.: `Main-html/` → strip, `Main-html/vendor/react.js` → `vendor/react.js`. */
function detectWrapperPrefix(paths: string[]): string {
  if (paths.length === 0) return '';
  const first = paths[0];
  const slashIdx = first.indexOf('/');
  if (slashIdx === -1) return '';
  const candidate = first.slice(0, slashIdx + 1);
  if (paths.every((p) => p.startsWith(candidate))) return candidate;
  return '';
}

/** Sobe um artefato — arquivo único, ou pasta de arquivos (site estático) via .zip extraído em
 * memória. Agnóstico de quem consome: não conhece Proposal nem nenhuma outra feature. */
@Injectable()
export class UploadArtifactUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly storageService: StorageService,
    private readonly systemConfig: SystemConfigurationService,
  ) {}

  async execute(
    file: UploadArtifactFile | undefined,
    user: AuthenticatedUser,
    name?: string,
  ): Promise<Artifact> {
    if (!file) {
      throw new BadRequestException(
        this.i18n.t('artifact.invalid_content_type'),
      );
    }

    const isZip =
      ARTIFACT_ZIP_MIME_TYPES.has(file.mimetype) ||
      file.originalname.toLowerCase().endsWith('.zip');

    const created = isZip
      ? await this.uploadFolder(file, user, name)
      : await this.uploadFile(file, user, name);

    await this.loggingService.create(
      {
        module: 'ARTIFACT',
        action: LogActions.CREATE,
        message: `Artefato enviado: ${created.fileName}`,
        metadata: { artifactId: created.id, kind: created.kind },
      },
      user.id,
    );

    return created;
  }

  private async uploadFile(
    file: UploadArtifactFile,
    user: AuthenticatedUser,
    name?: string,
  ): Promise<Artifact> {
    if (!ARTIFACT_FILE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        this.i18n.t('artifact.invalid_content_type'),
      );
    }

    const maxSizeBytes = await this.readConfiguredSize(
      ARTIFACT_CONFIG_KEYS.fileMaxSizeBytes,
      ARTIFACT_FILE_DEFAULT_MAX_SIZE_BYTES,
    );
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(this.i18n.t('artifact.too_large'));
    }

    const ext = this.extensionForMimetype(file.mimetype);
    const key = this.storageService.buildKey('artifacts', ext);
    await this.storageService.upload(key, file.buffer, file.mimetype);

    const entry: ArtifactManifestEntry = {
      path: file.originalname,
      contentType: file.mimetype,
      sizeBytes: file.size,
    };

    return this.prisma.artifact.create({
      data: {
        kind: 'FILE',
        name: name ?? null,
        storageKey: key,
        fileName: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
        files: [entry] as unknown as Prisma.InputJsonValue,
        createdById: user.id,
      },
    });
  }

  private async uploadFolder(
    file: UploadArtifactFile,
    user: AuthenticatedUser,
    name?: string,
  ): Promise<Artifact> {
    const zipMaxSizeBytes = await this.readConfiguredSize(
      ARTIFACT_CONFIG_KEYS.zipMaxSizeBytes,
      ARTIFACT_ZIP_DEFAULT_MAX_SIZE_BYTES,
    );
    if (file.size > zipMaxSizeBytes) {
      throw new BadRequestException(this.i18n.t('artifact.zip_too_large'));
    }

    const directory = await unzipper.Open.buffer(file.buffer);
    const fileEntries = directory.files.filter(
      (entry) => entry.type === 'File',
    );

    const folderMaxSizeBytes = await this.readConfiguredSize(
      ARTIFACT_CONFIG_KEYS.folderMaxSizeBytes,
      ARTIFACT_FOLDER_DEFAULT_MAX_SIZE_BYTES,
    );
    const totalUncompressed = fileEntries.reduce(
      (sum, entry) => sum + entry.uncompressedSize,
      0,
    );
    if (totalUncompressed > folderMaxSizeBytes) {
      throw new BadRequestException(this.i18n.t('artifact.folder_too_large'));
    }

    const rawNormalized: string[] = [];
    for (const entry of fileEntries) {
      const baseName = entry.path.split(/[/\\]/).pop() ?? '';
      if (ARTIFACT_ZIP_IGNORED_ENTRIES.has(baseName)) continue;
      const n = normalizeZipEntryPath(entry.path);
      if (!n) {
        throw new BadRequestException(
          this.i18n.t('artifact.invalid_entry_path'),
        );
      }
      rawNormalized.push(n);
    }
    const wrapperPrefix = detectWrapperPrefix(rawNormalized);

    const manifest: Array<
      ArtifactManifestEntry & { source: (typeof fileEntries)[number] }
    > = [];

    let rawIdx = 0;
    for (const entry of fileEntries) {
      const baseName = entry.path.split(/[/\\]/).pop() ?? '';
      if (ARTIFACT_ZIP_IGNORED_ENTRIES.has(baseName)) continue;

      const normalized = rawNormalized[rawIdx++].slice(wrapperPrefix.length);
      if (!normalized) continue;

      // bits altos de externalFileAttributes carregam o unix mode; S_IFLNK = 0xA000 = symlink.
      const unixMode = entry.externalFileAttributes >>> 16;
      if ((unixMode & 0xf000) === 0xa000) {
        throw new BadRequestException(
          this.i18n.t('artifact.symlink_entry_rejected'),
        );
      }

      const ext = normalized.split('.').pop()?.toLowerCase();
      const contentType = ext
        ? ARTIFACT_CONTENT_TYPES_BY_EXTENSION[ext as ArtifactExtension]
        : undefined;
      if (!contentType) {
        throw new BadRequestException(
          this.i18n.t('artifact.invalid_entry_content_type'),
        );
      }

      manifest.push({
        path: normalized,
        contentType,
        sizeBytes: entry.uncompressedSize,
        source: entry,
      });
    }

    if (!manifest.length) {
      throw new BadRequestException(this.i18n.t('artifact.empty_folder'));
    }

    // ponytail: entry point — index.html exato, ou o único .html raiz do zip.
    let entryFile = manifest.find(
      (e) => e.path === ARTIFACT_DEFAULT_ENTRY_FILE_NAME,
    );
    if (!entryFile) {
      const rootHtmlFiles = manifest.filter(
        (e) => !e.path.includes('/') && e.contentType === 'text/html',
      );
      if (rootHtmlFiles.length === 1) entryFile = rootHtmlFiles[0];
    }
    if (!entryFile) {
      throw new BadRequestException(this.i18n.t('artifact.missing_entry_file'));
    }

    // Só extrai e sobe depois que TODAS as entradas passaram validação — evita limpar storage
    // parcial se uma entrada no meio do zip falhasse.
    const folderKey = this.storageService.buildFolderKey('artifacts');
    for (const item of manifest) {
      const buffer = await item.source.buffer();
      await this.storageService.upload(
        `${folderKey}${item.path}`,
        buffer,
        item.contentType,
      );
    }

    return this.prisma.artifact.create({
      data: {
        kind: 'FOLDER',
        name: name ?? null,
        storageKey: folderKey,
        entryFileName: entryFile.path,
        fileName: file.originalname,
        files: manifest.map(({ path, contentType, sizeBytes }) => ({
          path,
          contentType,
          sizeBytes,
        })),
        sizeBytes: totalUncompressed,
        createdById: user.id,
      },
    });
  }

  private extensionForMimetype(mimetype: string): string {
    if (mimetype === 'text/javascript') return 'js';
    const match = Object.entries(ARTIFACT_CONTENT_TYPES_BY_EXTENSION).find(
      ([, type]) => type === mimetype,
    );
    return match?.[0] ?? 'bin';
  }

  private async readConfiguredSize(
    key: string,
    fallback: number,
  ): Promise<number> {
    const raw = await this.systemConfig.getValueOrNull(key);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
