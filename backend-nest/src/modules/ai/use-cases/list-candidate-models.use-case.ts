import { Injectable } from '@nestjs/common';
import { AiService } from '../ai.service';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import { AiProviderConst, AI_CONFIG_KEYS } from 'src/domain/ai/ai.const';
import type { ListAiModelsDto } from '../dto/list-ai-models.dto';

/** Lista os modelos reais de um provider a partir de uma config ainda não salva. */
@Injectable()
export class ListCandidateAiModelsUseCase {
  constructor(
    private readonly aiService: AiService,
    private readonly sysConfig: SystemConfigurationService,
  ) {}

  async execute(dto: ListAiModelsDto): Promise<{ models: string[] }> {
    const keys = AI_CONFIG_KEYS[dto.provider];
    const apiKey = await this.sysConfig.keepStoredWhenBlank(
      dto.apiKey,
      keys.apiKey,
    );

    let baseUrl: string | undefined;
    if (dto.provider === AiProviderConst.OPENAI_COMPATIBLE) {
      baseUrl =
        dto.baseUrl?.trim() ||
        (await this.sysConfig.getValueOrNull(keys.baseUrl!)) ||
        '';
      if (!baseUrl) return { models: [] };
    } else if (!apiKey) {
      return { models: [] };
    }

    const models = await this.aiService.listModelsForCandidate({
      engine: dto.provider,
      apiKey,
      model: '',
      baseUrl,
    });
    return { models };
  }
}
