/** Allowlist de `contentType` aceitos no upload de artefato, mapeados para a extensão da storage key. */
export const PROPOSAL_ARTIFACT_CONTENT_TYPES = {
  'text/html': 'html',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
} as const;

export type ProposalArtifactContentType =
  keyof typeof PROPOSAL_ARTIFACT_CONTENT_TYPES;

/** Chave em `SystemConfiguration` com o tamanho máximo (bytes) aceito no upload. */
export const PROPOSAL_ARTIFACT_CONFIG_KEYS = {
  maxSizeBytes: 'SYSTEM_PROPOSAL_ARTIFACT_MAX_SIZE_BYTES',
} as const;

// ponytail: default conservador sem tela de ajuste nesta etapa — trocar por um controle em
// /settings quando a demanda aparecer (F4).
export const PROPOSAL_ARTIFACT_DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024;

/** Teto rígido do multer, independente do valor configurável acima — defesa contra upload
 * gigante consumir memória antes do use-case conseguir validar o tamanho real. */
export const PROPOSAL_ARTIFACT_UPLOAD_HARD_LIMIT_BYTES = 20 * 1024 * 1024;
