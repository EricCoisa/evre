import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import { RedisService } from 'src/common/infrastructure/redis/redis.service';
import type { IStorageProvider } from 'src/domain/interface/storage-provider.interface';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import {
  StorageEngineConst,
  STORAGE_CONFIG_KEYS,
} from 'src/domain/storage/storage.const';
import { S3StorageService } from './providers/s3-storage.service';
import { LocalStorageService } from './providers/local-storage.service';
import { S3ConfigDto } from './dto/s3-config.dto';
import { LocalConfigDto } from './dto/local-config.dto';

const STORAGE_HEALTH_KEY = 'storage:health';
const STORAGE_HEALTH_TTL = 300;

/** Credenciais candidatas (ainda não gravadas) — ver `validateCandidate`. */
export type StorageCandidateConfig =
  | { provider: 'S3'; s3: S3ConfigDto }
  | { provider: 'LOCAL'; local: LocalConfigDto };

@Injectable()
export class StorageService {
  constructor(
    private readonly systemConfig: SystemConfigurationService,
    private readonly s3: S3StorageService,
    private readonly local: LocalStorageService,
    private readonly redis: RedisService,
  ) {}

  async upload(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    return (await this.provider()).upload(key, buffer, contentType);
  }

  async delete(key: string): Promise<void> {
    return (await this.provider()).delete(key);
  }

  async getPublicUrl(key: string): Promise<string> {
    return (await this.provider()).getPublicUrl(key);
  }

  async getPresignedUrl(key: string, ttlSeconds?: number): Promise<string> {
    return (await this.provider()).getPresignedUrl(key, ttlSeconds);
  }

  async getShareableUrl(key: string): Promise<string> {
    return (await this.provider()).getShareableUrl(key);
  }

  async validateConfiguration(): Promise<ProviderResult> {
    return (await this.provider()).validateConfiguration();
  }

  /** Valida credenciais ainda não gravadas — é o que permite validar antes de salvar. */
  async validateCandidate(
    candidate: StorageCandidateConfig,
  ): Promise<ProviderResult> {
    try {
      const provider =
        candidate.provider === StorageEngineConst.LOCAL
          ? this.local.use(candidate.local)
          : this.s3.use(candidate.s3);
      return await provider.validateConfiguration();
    } catch (err) {
      return { status: false, data: String((err as Error)?.message ?? err) };
    }
  }

  async checkHealth(): Promise<{ operational: boolean; reason?: string }> {
    const cached = await this.redis.get(STORAGE_HEALTH_KEY);
    if (cached !== null) {
      return JSON.parse(cached) as { operational: boolean; reason?: string };
    }
    const res = await this.validateConfiguration();
    const result: { operational: boolean; reason?: string } = {
      operational: res.status,
      ...(res.status ? {} : { reason: String(res.data) }),
    };
    await this.redis.set(
      STORAGE_HEALTH_KEY,
      JSON.stringify(result),
      STORAGE_HEALTH_TTL,
    );
    return result;
  }

  async invalidateHealthCache(): Promise<void> {
    await this.redis.del(STORAGE_HEALTH_KEY);
  }

  /** `APP_NAME` isola a pasta de cada app num storage compartilhado entre projetos. */
  buildKey(prefix: string, ext: string): string {
    return `${process.env.APP_NAME}/${prefix}/${randomUUID()}.${ext}`;
  }

  /** Prefixo de pasta, sem extensão, terminado em "/" — cada arquivo sobe via `upload()` normal
   * com a key `${folderKey}${caminhoRelativo}`. S3 e LOCAL já tratam "/" na key como path. */
  buildFolderKey(prefix: string): string {
    return `${process.env.APP_NAME}/${prefix}/${randomUUID()}/`;
  }

  async resolveKeyFromUrl(
    url: string | null | undefined,
  ): Promise<string | null> {
    if (!url) return null;
    // Remove o prefixo público do provider (bucket no S3, /uploads no LOCAL) para recuperar a key.
    const prefix = await this.getPublicUrl('');
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }

  /** Acha entre S3 e LOCAL, ativo ou não, qual provider é dono da URL salva. */
  async resolveFileFromUrl(
    url: string | null | undefined,
  ): Promise<{ provider: IStorageProvider; key: string } | null> {
    if (!url) return null;
    const candidates = [
      this.s3.use(await this.readS3Config()),
      this.local.use(await this.readLocalConfig()),
    ];
    for (const provider of candidates) {
      const prefix = provider.getPublicUrl('');
      if (url.startsWith(prefix))
        return { provider, key: url.slice(prefix.length) };
    }
    return null;
  }

  /** Retorna o diretório do provider LOCAL resolvido (DB, depois env, depois default). */
  async getLocalStorageDir(): Promise<string> {
    return (await this.readLocalConfig()).dir;
  }

  private async provider(): Promise<IStorageProvider> {
    const engine =
      (await this.readConfigValue(STORAGE_CONFIG_KEYS.provider)) ??
      StorageEngineConst.S3;

    switch (engine) {
      case StorageEngineConst.LOCAL:
        return this.local.use(await this.readLocalConfig());
      case StorageEngineConst.S3:
      default:
        return this.s3.use(await this.readS3Config());
    }
  }

  private async readS3Config(): Promise<S3ConfigDto> {
    const cfg = new S3ConfigDto();
    cfg.endpoint =
      (await this.readConfigValue(STORAGE_CONFIG_KEYS.s3Endpoint)) ??
      process.env.S3_ENDPOINT ??
      'http://localhost:8333';
    cfg.region =
      (await this.readConfigValue(STORAGE_CONFIG_KEYS.s3Region)) ??
      process.env.S3_REGION ??
      'us-east-1';
    cfg.bucket =
      (await this.readConfigValue(STORAGE_CONFIG_KEYS.s3Bucket)) ??
      process.env.S3_BUCKET ??
      'app-uploads';
    cfg.accessKey =
      (await this.readConfigValue(STORAGE_CONFIG_KEYS.s3AccessKey)) ??
      process.env.S3_ACCESS_KEY ??
      '';
    cfg.secretKey =
      (await this.readConfigValue(STORAGE_CONFIG_KEYS.s3SecretKey)) ??
      process.env.S3_SECRET_KEY ??
      '';
    cfg.publicUrl =
      (await this.readConfigValue(STORAGE_CONFIG_KEYS.s3PublicUrl)) ??
      process.env.S3_PUBLIC_URL ??
      'http://localhost:8333/app-uploads';
    return cfg;
  }

  private async readLocalConfig(): Promise<LocalConfigDto> {
    const cfg = new LocalConfigDto();
    cfg.dir =
      (await this.readConfigValue(STORAGE_CONFIG_KEYS.localDir)) ??
      process.env.STORAGE_LOCAL_DIR ??
      './uploads';
    cfg.baseUrl =
      (await this.readConfigValue(STORAGE_CONFIG_KEYS.publicBaseUrl)) ??
      process.env.STORAGE_PUBLIC_BASE_URL ??
      'http://localhost:3001';
    return cfg;
  }

  // findByLabelKey throws NotFoundException when key missing — catch and return null for graceful
  // fallback. String vazia conta como "não configurado" também — senão o `??` dos callers nunca
  // cai no fallback de env/default quando o seed grava a chave como placeholder em branco.
  private async readConfigValue(labelKey: string): Promise<string | null> {
    try {
      const record = await this.systemConfig.findByLabelKey(labelKey);
      const value = record?.value as string | undefined;
      return value ? value : null;
    } catch (err) {
      if (err instanceof NotFoundException) return null;
      throw err;
    }
  }
}
