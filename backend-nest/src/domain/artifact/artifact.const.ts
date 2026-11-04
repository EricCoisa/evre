/** Allowlist de extensão→contentType — serve o upload de arquivo único e a validação de cada
 * entrada de um .zip (pasta). Fonte única: zip não carrega content-type por entrada. */
export const ARTIFACT_CONTENT_TYPES_BY_EXTENSION = {
  html: 'text/html',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  css: 'text/css',
  js: 'application/javascript',
  json: 'application/json',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ico: 'image/x-icon',
} as const;

export type ArtifactExtension = keyof typeof ARTIFACT_CONTENT_TYPES_BY_EXTENSION;

/** Mimetypes aceitos no upload de arquivo único — `.js` tem dois valores válidos no mundo real. */
export const ARTIFACT_FILE_MIME_TYPES = new Set<string>([
  ...Object.values(ARTIFACT_CONTENT_TYPES_BY_EXTENSION),
  'text/javascript',
]);

export const ARTIFACT_ZIP_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
]);

/** Chaves em `SystemConfiguration` com os tamanhos máximos (bytes) aceitos no upload. */
export const ARTIFACT_CONFIG_KEYS = {
  fileMaxSizeBytes: 'SYSTEM_ARTIFACT_FILE_MAX_SIZE_BYTES',
  zipMaxSizeBytes: 'SYSTEM_ARTIFACT_ZIP_MAX_SIZE_BYTES',
  folderMaxSizeBytes: 'SYSTEM_ARTIFACT_FOLDER_MAX_SIZE_BYTES',
} as const;

export const ARTIFACT_FILE_DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024;
// .zip comprimido — checado antes de abrir o central directory.
export const ARTIFACT_ZIP_DEFAULT_MAX_SIZE_BYTES = 20 * 1024 * 1024;
// soma do uncompressedSize de todas as entradas do zip.
export const ARTIFACT_FOLDER_DEFAULT_MAX_SIZE_BYTES = 50 * 1024 * 1024;

/** Teto rígido do multer, independente dos valores configuráveis acima — defesa contra upload
 * gigante consumir memória antes do use-case conseguir validar o tamanho real. */
export const ARTIFACT_UPLOAD_HARD_LIMIT_BYTES = 80 * 1024 * 1024;

/** Entradas de zip ignoradas silenciosamente — lixo comum de SO/editor, nunca servido. */
export const ARTIFACT_ZIP_IGNORED_ENTRIES = new Set(['.DS_Store', 'Thumbs.db']);

export const ARTIFACT_DEFAULT_ENTRY_FILE_NAME = 'index.html';
