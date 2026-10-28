import { assertProviderOk } from 'src/common/utils/provider-result.util';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AiService } from '../ai.service';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import {
  AiProviderConst,
  AI_CONFIG_KEYS as KEYS,
} from 'src/domain/ai/ai.const';
import type { SaveAiConfigDto } from '../dto/save-ai-config.dto';

/** Valida o formulário contra o provider real (plataforma) e só então persiste. */
@Injectable()
export class SaveAiConfigurationUseCase {
  constructor(
    private readonly aiService: AiService,
    private readonly sysConfig: SystemConfigurationService,
  ) {}

  async execute(dto: SaveAiConfigDto, performedById: string) {
    const keys = KEYS[dto.provider];
    const isCompatible = dto.provider === AiProviderConst.OPENAI_COMPATIBLE;

    const apiKey = await this.sysConfig.keepStoredWhenBlank(
      dto.apiKey,
      keys.apiKey,
    );
    // Ollama/LM Studio rodam sem chave; os provedores hospedados, não.
    if (!apiKey && !isCompatible) {
      throw new BadRequestException('apiKey é obrigatória para este provider');
    }

    const result = await this.aiService.validateCandidate({
      engine: dto.provider,
      apiKey,
      model: dto.model,
      baseUrl: isCompatible ? dto.baseUrl : undefined,
    });
    assertProviderOk(result);

    // Grava só as chaves do provider editado; não altera `SYSTEM_AI_PROVIDER` (qual está ativo).
    await this.sysConfig.setManyByLabelKey(
      [
        { labelKey: keys.model, value: dto.model },
        { labelKey: keys.apiKey, value: apiKey, secret: true },
        ...(isCompatible
          ? [
              {
                labelKey: KEYS[AiProviderConst.OPENAI_COMPATIBLE].baseUrl!,
                value: dto.baseUrl ?? '',
              },
            ]
          : []),
      ],
      performedById,
    );

    await this.aiService.invalidateHealthCache();

    return { status: true, data: 'Configuração salva' };
  }
}
