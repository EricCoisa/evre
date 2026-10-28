import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ChatAnthropic } from '@langchain/anthropic';
import type {
  IAiService,
  IAiProvider,
} from 'src/domain/interface/ai-provider.interface';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import type { AnthropicConfigDto } from '../dto/anthropic-config.dto';

@Injectable()
export class AnthropicAiProvider implements IAiService<AnthropicConfigDto> {
  private readonly logger = new Logger(AnthropicAiProvider.name);

  use(cfg: AnthropicConfigDto): IAiProvider {
    const client = new Anthropic({ apiKey: cfg.apiKey, timeout: 8000 });
    return {
      validateConfiguration: () => this._validate(client, cfg.model),
      listModels: () => this._listModels(client),
    };
  }

  private async _validate(
    client: Anthropic,
    model: string,
  ): Promise<ProviderResult> {
    try {
      await client.messages.create({
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return { status: true, data: 'API key valid' };
    } catch (error) {
      return {
        status: false,
        data: String((error as Error)?.message ?? error),
      };
    }
  }

  private async _listModels(client: Anthropic): Promise<string[]> {
    try {
      const res = await client.models.list();
      return res.data.map((m) => m.id);
    } catch {
      // Fallback estático — Anthropic pode não expor list em versões antigas do SDK
      return [
        'claude-sonnet-4-6',
        'claude-opus-4-6',
        'claude-haiku-4-5-20251001',
      ];
    }
  }
}

/** ChatAnthropic puro (sem stream/tools) — construção isolada, usada pelo `_chat` acima. */
export function buildChatAnthropic(
  apiKey: string,
  model: string,
  maxTokens = 4096,
): ChatAnthropic {
  return new ChatAnthropic({ apiKey, model, maxTokens });
}
