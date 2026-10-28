import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ChatOpenAI } from '@langchain/openai';
import type {
  IAiService,
  IAiProvider,
} from 'src/domain/interface/ai-provider.interface';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import type { OpenAiConfigDto } from '../dto/openai-config.dto';

@Injectable()
export class OpenAiProvider implements IAiService<OpenAiConfigDto> {
  private readonly logger = new Logger(OpenAiProvider.name);

  use(cfg: OpenAiConfigDto): IAiProvider {
    const client = new OpenAI({ apiKey: cfg.apiKey, timeout: 8000 });
    return {
      validateConfiguration: () => openAiValidate(client, this.logger),
      listModels: async () => {
        const res = await client.models.list();
        return res.data.map((m) => m.id).sort();
      },
    };
  }
}

// Deriva do construtor do ChatOpenAI: o `@langchain/openai` fixa uma major própria do pacote `openai`.
type ChatOpenAIConfiguration = NonNullable<
  ConstructorParameters<typeof ChatOpenAI>[0]
>['configuration'];

/** Constrói o `ChatOpenAI` base, compartilhado pelo provider OpenAI e pelo OpenAI-Compatible. */
export function buildChatOpenAI(
  apiKey: string,
  model: string,
  configuration?: ChatOpenAIConfiguration,
  compat = false,
  maxTokens = 4096,
): ChatOpenAI {
  return new ChatOpenAI({
    apiKey,
    model,
    maxTokens,
    streamUsage: !compat,
    configuration,
  });
}

export async function openAiValidate(
  client: OpenAI,
  logger?: Logger,
): Promise<ProviderResult> {
  try {
    logger?.log('[OpenAI] Validating configuration - calling models.list()');
    const models = await client.models.list();
    logger?.log(
      `[OpenAI] Validation successful. Models found: ${models.data.length}`,
    );
    return { status: true, data: 'API key valid' };
  } catch (error) {
    const errorMsg = (error as Error)?.message ?? String(error);
    logger?.error(`[OpenAI] Validation failed: ${errorMsg}`, error);
    logger?.debug(`[OpenAI] Full error object:`, error);
    return {
      status: false,
      data: errorMsg,
    };
  }
}
