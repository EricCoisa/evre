export const StorageEngineConst = {
  S3: 'S3',
  LOCAL: 'LOCAL',
} as const;

export type StorageEngine = keyof typeof StorageEngineConst;
export type StorageEngineValue =
  (typeof StorageEngineConst)[keyof typeof StorageEngineConst];

/** Chaves em SystemConfiguration que descrevem o provider de storage. */
export const STORAGE_CONFIG_KEYS = {
  provider: 'SYSTEM_STORAGE_PROVIDER',
  s3Endpoint: 'SYSTEM_STORAGE_S3_ENDPOINT',
  s3Region: 'SYSTEM_STORAGE_S3_REGION',
  s3Bucket: 'SYSTEM_STORAGE_S3_BUCKET',
  s3AccessKey: 'SYSTEM_STORAGE_S3_ACCESS_KEY',
  s3SecretKey: 'SYSTEM_STORAGE_S3_SECRET_KEY',
  s3PublicUrl: 'SYSTEM_STORAGE_S3_PUBLIC_URL',
  localDir: 'SYSTEM_STORAGE_LOCAL_DIR',
  publicBaseUrl: 'SYSTEM_STORAGE_PUBLIC_BASE_URL',
} as const;
