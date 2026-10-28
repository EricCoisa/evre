import { assertProviderOk } from 'src/common/utils/provider-result.util';
import { Injectable } from '@nestjs/common';
import { StorageService } from '../storage.service';
import type { StorageCandidateConfig } from '../storage.service';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import {
  StorageEngineConst,
  STORAGE_CONFIG_KEYS,
} from 'src/domain/storage/storage.const';
import { S3ConfigDto } from '../dto/s3-config.dto';
import { LocalConfigDto } from '../dto/local-config.dto';
import type { SaveStorageConfigDto } from '../dto/save-storage-config.dto';

/** Valida o formulário contra o provider real e só então persiste. */
@Injectable()
export class SaveStorageConfigurationUseCase {
  constructor(
    private readonly storageService: StorageService,
    private readonly sysConfig: SystemConfigurationService,
  ) {}

  async execute(dto: SaveStorageConfigDto, performedById: string) {
    const isS3 = dto.provider === StorageEngineConst.S3;

    // Segredo em branco = manter o gravado (o GET devolve `****`, nunca o valor).
    const accessKey = await this.sysConfig.keepStoredWhenBlank(
      dto.accessKey,
      STORAGE_CONFIG_KEYS.s3AccessKey,
    );
    const secretKey = await this.sysConfig.keepStoredWhenBlank(
      dto.secretKey,
      STORAGE_CONFIG_KEYS.s3SecretKey,
    );

    const candidate = this.buildCandidate(dto, isS3, accessKey, secretKey);
    const result = await this.storageService.validateCandidate(candidate);
    assertProviderOk(result);

    await this.sysConfig.setManyByLabelKey(
      [
        {
          labelKey: STORAGE_CONFIG_KEYS.provider,
          value: dto.provider,
          valueType: 'ENUM',
          options: [StorageEngineConst.S3, StorageEngineConst.LOCAL],
        },
        ...(isS3
          ? [
              {
                labelKey: STORAGE_CONFIG_KEYS.s3Endpoint,
                value: dto.endpoint ?? '',
              },
              {
                labelKey: STORAGE_CONFIG_KEYS.s3Region,
                value: dto.region ?? '',
              },
              {
                labelKey: STORAGE_CONFIG_KEYS.s3Bucket,
                value: dto.bucket ?? '',
              },
              {
                labelKey: STORAGE_CONFIG_KEYS.s3AccessKey,
                value: accessKey,
                secret: true,
              },
              {
                labelKey: STORAGE_CONFIG_KEYS.s3SecretKey,
                value: secretKey,
                secret: true,
              },
              {
                labelKey: STORAGE_CONFIG_KEYS.s3PublicUrl,
                value: dto.publicUrl ?? '',
              },
            ]
          : [
              { labelKey: STORAGE_CONFIG_KEYS.localDir, value: dto.dir ?? '' },
              {
                labelKey: STORAGE_CONFIG_KEYS.publicBaseUrl,
                value: dto.baseUrl ?? '',
              },
            ]),
      ],
      performedById,
    );

    await this.storageService.invalidateHealthCache();

    return { status: true, data: 'Configuração salva' };
  }

  private buildCandidate(
    dto: SaveStorageConfigDto,
    isS3: boolean,
    accessKey: string,
    secretKey: string,
  ): StorageCandidateConfig {
    if (isS3) {
      const s3 = new S3ConfigDto();
      s3.endpoint = dto.endpoint ?? '';
      s3.region = dto.region ?? '';
      s3.bucket = dto.bucket ?? '';
      s3.accessKey = accessKey;
      s3.secretKey = secretKey;
      s3.publicUrl = dto.publicUrl ?? '';
      return { provider: 'S3', s3 };
    }

    const local = new LocalConfigDto();
    local.dir = dto.dir ?? '';
    local.baseUrl = dto.baseUrl ?? '';
    return { provider: 'LOCAL', local };
  }
}
