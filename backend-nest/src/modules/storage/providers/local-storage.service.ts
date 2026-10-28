import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  IStorageService,
  IStorageProvider,
} from 'src/domain/interface/storage-provider.interface';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import type { LocalConfigDto } from '../dto/local-config.dto';

@Injectable()
export class LocalStorageService implements IStorageService<LocalConfigDto> {
  private readonly logger = new Logger(LocalStorageService.name);

  use(cfg: LocalConfigDto): IStorageProvider {
    return {
      upload: (key, buffer) => this._upload(cfg.dir, key, buffer),
      delete: (key) => this._delete(cfg.dir, key),
      getPublicUrl: (key) => `${cfg.baseUrl}/uploads/${key}`,
      getPresignedUrl: (key) =>
        Promise.resolve(`${cfg.baseUrl}/uploads/${key}`),
      validateConfiguration: () => this._validate(cfg.dir),
    };
  }

  private async _upload(
    dir: string,
    key: string,
    buffer: Buffer,
  ): Promise<string> {
    const dest = path.join(dir, key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);
    return key;
  }

  private async _delete(dir: string, key: string): Promise<void> {
    try {
      await fs.unlink(path.join(dir, key));
    } catch (err) {
      this.logger.warn(`Failed to delete local key ${key}`, err);
    }
  }

  private async _validate(dir: string): Promise<ProviderResult> {
    try {
      await fs.mkdir(dir, { recursive: true });
      const probe = path.join(dir, '.write-check');
      await fs.writeFile(probe, '');
      await fs.unlink(probe);
      return { status: true, data: 'Local storage directory is writable' };
    } catch (err) {
      return { status: false, data: String((err as Error)?.message ?? err) };
    }
  }
}
