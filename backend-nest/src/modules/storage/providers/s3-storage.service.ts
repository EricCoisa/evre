import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  IStorageService,
  IStorageProvider,
} from 'src/domain/interface/storage-provider.interface';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import type { S3ConfigDto } from '../dto/s3-config.dto';

@Injectable()
export class S3StorageService implements IStorageService<S3ConfigDto> {
  private readonly logger = new Logger(S3StorageService.name);

  use(cfg: S3ConfigDto): IStorageProvider {
    const client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKey,
        secretAccessKey: cfg.secretKey,
      },
      forcePathStyle: true,
    });

    return {
      upload: (key, buffer, contentType) =>
        this._upload(client, cfg.bucket, key, buffer, contentType),
      delete: (key) => this._delete(client, cfg.bucket, key),
      getPublicUrl: (key) => `${cfg.publicUrl}/${key}`,
      getPresignedUrl: (key, ttl) =>
        this._getPresignedUrl(client, cfg.bucket, key, ttl),
      getShareableUrl: (key) =>
        this._getPresignedUrl(client, cfg.bucket, key, 7 * 24 * 3600),
      validateConfiguration: () => this._validate(client, cfg.bucket),
    };
  }

  private async _upload(
    client: S3Client,
    bucket: string,
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return key;
  }

  private async _delete(
    client: S3Client,
    bucket: string,
    key: string,
  ): Promise<void> {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`Failed to delete S3 key ${key}`, err);
    }
  }

  private async _validate(
    client: S3Client,
    bucket: string,
  ): Promise<ProviderResult> {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      return { status: true, data: 'S3 bucket reachable' };
    } catch (err) {
      return { status: false, data: String((err as Error)?.message ?? err) };
    }
  }

  private async _getPresignedUrl(
    client: S3Client,
    bucket: string,
    key: string,
    ttlSeconds: number = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(client, command, { expiresIn: ttlSeconds });
  }
}
