import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type { IAiTool, AiToolDefinition } from 'src/domain/ai/ai-tool.types';
import { secretStatus } from 'src/domain/system-configuration/typed-config-keys.const';
import {
  StorageEngineConst,
  STORAGE_CONFIG_KEYS,
} from 'src/domain/storage/storage.const';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import { CheckStorageHealthUseCase } from '../use-cases/check-health.use-case';

/** Retorna a configuração atual de storage junto com a saúde do serviço. */
@AiToolDef()
@Injectable()
export class GetStorageConfigTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_storage_config',
    description:
      'Retorna a configuração atual de storage (provider S3 ou LOCAL, endpoint, região, bucket, URLs) junto com a saúde do serviço. Credenciais NÃO são retornadas — apenas se estão configuradas ou não. Use para diagnosticar falhas de upload ou conferir para onde os arquivos estão indo.',
    inputSchema: z.object({}),
    roles: ['ADMIN'],
  };

  constructor(
    private readonly sysConfig: SystemConfigurationService,
    private readonly checkHealth: CheckStorageHealthUseCase,
  ) {}

  async execute() {
    const get = (key: string) => this.sysConfig.getValueOrNull(key);

    const provider =
      (await get(STORAGE_CONFIG_KEYS.provider)) ?? StorageEngineConst.LOCAL;
    const health = await this.checkHealth.execute();

    if (provider === StorageEngineConst.S3) {
      return {
        provider,
        health,
        endpoint: await get(STORAGE_CONFIG_KEYS.s3Endpoint),
        region: await get(STORAGE_CONFIG_KEYS.s3Region),
        bucket: await get(STORAGE_CONFIG_KEYS.s3Bucket),
        publicUrl: await get(STORAGE_CONFIG_KEYS.s3PublicUrl),
        accessKey: secretStatus(await get(STORAGE_CONFIG_KEYS.s3AccessKey)),
        secretKey: secretStatus(await get(STORAGE_CONFIG_KEYS.s3SecretKey)),
      };
    }

    return {
      provider,
      health,
      dir: await get(STORAGE_CONFIG_KEYS.localDir),
      baseUrl: await get(STORAGE_CONFIG_KEYS.publicBaseUrl),
    };
  }
}
