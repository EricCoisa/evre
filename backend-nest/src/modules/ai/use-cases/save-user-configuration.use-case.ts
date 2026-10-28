import { assertProviderOk } from 'src/common/utils/provider-result.util';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AiService } from '../ai.service';
import { UserConfigurationService } from 'src/modules/user-configuration/user-configuration.service';
import { isUnreachableHost } from 'src/modules/messaging/providers/media-url.util';
import {
  AiProviderConst,
  USER_AI_CONFIG_KEYS as KEYS,
} from 'src/domain/ai/ai.const';
import type { SaveAiConfigDto } from '../dto/save-ai-config.dto';

/** Mesmo contrato do save da plataforma, mas escrevendo em UserConfiguration (BYOK). */
@Injectable()
export class SaveUserAiConfigurationUseCase {
  constructor(
    private readonly aiService: AiService,
    private readonly userConfig: UserConfigurationService,
  ) {}

  async execute(userId: string, dto: SaveAiConfigDto) {
    const keys = KEYS[dto.provider];
    const isCompatible = dto.provider === AiProviderConst.OPENAI_COMPATIBLE;

    // Recusa baseUrl sem https ou apontando para host privado.
    if (isCompatible && dto.baseUrl) {
      const { hostname, protocol } = new URL(dto.baseUrl);
      if (protocol !== 'https:' || isUnreachableHost(hostname)) {
        throw new BadRequestException(
          'baseUrl precisa ser uma URL https pública',
        );
      }
    }

    const apiKey = await this.userConfig.keepStoredWhenBlank(
      userId,
      dto.apiKey,
      keys.apiKey,
    );
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

    await this.userConfig.setManyByLabelKey(userId, [
      { labelKey: keys.model, value: dto.model },
      { labelKey: keys.apiKey, value: apiKey },
      ...(isCompatible
        ? [{ labelKey: keys.baseUrl!, value: dto.baseUrl ?? '' }]
        : []),
    ]);

    await this.aiService.invalidateHealthCache();

    return { status: true, data: 'Configuração salva' };
  }
}
