import type { ProviderResult } from 'src/domain/interface/provider-result';

export interface IStorageProvider {
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
  getPresignedUrl(key: string, ttlSeconds?: number): Promise<string>;
  validateConfiguration(): Promise<ProviderResult>;
}

export interface IStorageService<IConfig> {
  use(config: IConfig): IStorageProvider;
}
