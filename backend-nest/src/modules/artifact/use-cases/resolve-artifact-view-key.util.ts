import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ARTIFACT_DEFAULT_ENTRY_FILE_NAME } from 'src/domain/artifact/artifact.const';

interface ArtifactFileEntry {
  path: string;
  contentType: string;
  sizeBytes: number;
}

interface ViewableArtifact {
  kind: string;
  storageKey: string;
  entryFileName: string | null;
  files: unknown;
}

/** Resolve a key de storage a servir. FOLDER valida `subPath` contra o manifesto `files` —
 * rejeição explícita por allowlist, não sanitização de string, é o que fecha path traversal aqui. */
export function resolveArtifactViewKey(
  artifact: ViewableArtifact,
  subPath: string | undefined,
  i18n: I18nService,
): string {
  if (artifact.kind === 'FILE') return artifact.storageKey;

  const entry =
    subPath ?? artifact.entryFileName ?? ARTIFACT_DEFAULT_ENTRY_FILE_NAME;
  const manifest = (artifact.files as ArtifactFileEntry[] | null) ?? [];
  if (!manifest.some((item) => item.path === entry)) {
    throw new NotFoundException(i18n.t('artifact.not_found'));
  }

  return `${artifact.storageKey}${entry}`;
}
