import type { ProviderResult } from 'src/domain/interface/provider-result';

export interface IStorageProvider {
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
  /** URL sem credencial embutida — depende de ACL pública do bucket. Uso interno (parse de URL). */
  getPublicUrl(key: string): string;
  getPresignedUrl(key: string, ttlSeconds?: number): Promise<string>;
  /** URL acessível externamente sem autenticação — credencial embutida pelo provider. */
  getShareableUrl(key: string): Promise<string>;
  validateConfiguration(): Promise<ProviderResult>;
}

export interface IStorageService<IConfig> {
  use(config: IConfig): IStorageProvider;
}
