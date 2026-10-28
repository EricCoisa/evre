import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { SaveStorageConfigSchema } from '../dto/save-storage-config.dto';
import type { SaveStorageConfigDto } from '../dto/save-storage-config.dto';
import { SaveStorageConfigurationUseCase } from '../use-cases/save-configuration.use-case';

/** Reusa o use-case do `PUT /storage/config`: valida no provider antes de gravar e mantém segredo omitido. */
@AiToolDef()
@Injectable()
export class SaveStorageConfigTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'save_storage_config',
    description:
      'Valida e salva a configuração de storage. Para S3 exige endpoint, region, bucket e publicUrl; para LOCAL exige dir e baseUrl. As credenciais (accessKey/secretKey) são opcionais: OMITA-AS para manter as já gravadas — enviar string vazia tem o mesmo efeito, nunca apaga. A configuração é testada contra o provider real antes de persistir: se o provider recusar, nada é gravado e o motivo é retornado. Confirme com o usuário antes de trocar o provider de um sistema em uso — arquivos já enviados não migram.',
    inputSchema: SaveStorageConfigSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.SYSTEM_CONFIGURATION_WRITE,
    invalidates: [
      InvalidationTags.SYSTEM_CONFIGURATION,
      InvalidationTags.STORAGE,
    ],
  };

  constructor(private readonly saveConfig: SaveStorageConfigurationUseCase) {}

  execute(input: SaveStorageConfigDto, ctx: AiToolContext) {
    return this.saveConfig.execute(input, ctx.userId);
  }
}
