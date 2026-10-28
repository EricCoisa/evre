import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import { RedisService } from 'src/common/infrastructure/redis/redis.service';
import { UserConfigurationService } from 'src/modules/user-configuration/user-configuration.service';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AnthropicAiProvider,
  buildChatAnthropic,
} from './providers/anthropic.provider';
import { OpenAiProvider, buildChatOpenAI } from './providers/openai.provider';
import {
  OpenAiCompatibleProvider,
  WAF_BYPASS_HEADERS,
} from './providers/openai-compatible.provider';
import type { IAiProvider } from 'src/domain/interface/ai-provider.interface';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import {
  AiProviderConst,
  AI_HEALTH_KEY,
  BASE_AGENT_SYSTEM_PROMPT,
  USER_AI_CONFIG_KEYS,
  type AiProvider,
} from 'src/domain/ai/ai.const';
import {
  describeScreen,
  type ScreenItem,
} from 'src/domain/ai/screen-context.const';
import { ToolRegistry } from './tool-registry.service';
import { AnthropicConfigDto } from './dto/anthropic-config.dto';
import { OpenAiConfigDto } from './dto/openai-config.dto';
import { OpenAiCompatibleConfigDto } from './dto/openai-compatible-config.dto';

const AI_HEALTH_TTL = 300;

/** Valor cru do config → inteiro positivo, ou `undefined` (fallback pro default do provider). */
function parseMaxTokens(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export class AiNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiNotConfiguredError';
  }
}

/** Contexto do turno vindo do front: onde o usuário está e o que ele tem na tela. */
export interface PromptScreenContext {
  /** Path + query da tela aberta. */
  page?: string;
  /** Itens montados na tela (tabelas, campos de config, registro aberto). */
  items?: ScreenItem[];
  /** Role do usuário — filtra quais tools podem ser citadas. */
  roleName?: string;
}

export interface ResolvedAiConfig {
  engine: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxTokens?: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly systemConfig: SystemConfigurationService,
    private readonly anthropic: AnthropicAiProvider,
    private readonly openai: OpenAiProvider,
    private readonly openaiCompatible: OpenAiCompatibleProvider,
    private readonly redis: RedisService,
    private readonly userConfigService: UserConfigurationService,
    private readonly toolRegistry: ToolRegistry,
  ) {}

  /** Devolve o `BaseChatModel` do LangChain já configurado (plataforma ou BYOK) para o usuário. */
  async getChatModel(
    userId?: string,
    modelOverride?: string,
  ): Promise<BaseChatModel> {
    const byok =
      (await this.readConfigValue('SYSTEM_AGENT_OWN_KEY')) === 'true';
    const cfg = byok
      ? await this.resolveUserConfig(userId)
      : await this.resolveSystemConfig();
    const model = modelOverride || cfg.model;

    switch (cfg.engine) {
      case AiProviderConst.ANTHROPIC:
        return cfg.maxTokens
          ? buildChatAnthropic(cfg.apiKey, model, cfg.maxTokens)
          : buildChatAnthropic(cfg.apiKey, model);
      case AiProviderConst.OPENAI:
        return cfg.maxTokens
          ? buildChatOpenAI(cfg.apiKey, model, undefined, false, cfg.maxTokens)
          : buildChatOpenAI(cfg.apiKey, model);
      case AiProviderConst.OPENAI_COMPATIBLE:
        return buildChatOpenAI(
          cfg.apiKey || 'not-needed',
          model,
          { baseURL: cfg.baseUrl, defaultHeaders: WAF_BYPASS_HEADERS },
          true,
          cfg.maxTokens || 4096,
        );
      default:
        throw new AiNotConfiguredError(`Provider desconhecido: ${cfg.engine}`);
    }
  }

  /** Monta o system prompt: baseline + prompt global (admin) + prompt pessoal (usuário) + contexto da tela. */
  async buildSystemPrompt(
    userId: string,
    screen?: PromptScreenContext,
  ): Promise<string> {
    const parts = [BASE_AGENT_SYSTEM_PROMPT];

    try {
      const globalPrompt = await this.systemConfig.findByLabelKey(
        'SYSTEM_AI_SYSTEM_PROMPT',
      );
      if (
        globalPrompt?.value &&
        typeof globalPrompt.value === 'string' &&
        globalPrompt.value.trim()
      ) {
        parts.push(globalPrompt.value);
      }
    } catch {
      /* Config not found */
    }

    try {
      const userPrompt = (await this.userConfigService.getDecryptedValueForUser(
        userId,
        'USERCONFIG_AGENT_PROMPT',
      )) as string | null;
      if (userPrompt?.trim()) parts.push(userPrompt);
    } catch {
      /* Config not found */
    }

    // Contexto para desambiguar pedidos que apontam para o que está na tela
    // ("esse usuário", "aqui"); não é ordem de navegar nem de agir sobre a tela.
    if (screen?.page) {
      parts.push(
        `O usuário está com a tela ${screen.page} aberta no aplicativo. Use isso apenas ` +
          'como contexto para entender a que ele se refere; não trate como pedido de ação.',
      );
    }

    // O contexto de tela vira a lista de tools do domínio correspondente, já filtrada por role.
    if (screen?.items?.length) {
      const allowed = await this.toolRegistry.getToolDefinitions({
        roleName: screen.roleName ?? '',
        userId,
      });
      const described = describeScreen(
        screen.items,
        allowed.map((tool) => ({
          name: tool.name,
          group: this.toolRegistry.getToolGroup(tool.name),
        })),
      );
      if (described) parts.push(described);
    }

    return parts.join('\n\n');
  }

  async validateConfiguration(): Promise<ProviderResult> {
    try {
      this.logger.log('[AiService] Starting configuration validation');
      const result = await (await this.provider()).validateConfiguration();
      this.logger.log(
        `[AiService] Validation result: status=${result.status}, data=${result.data}`,
      );
      // Invalidate health cache so next checkHealth reflects the new validation state
      await this.redis.del(AI_HEALTH_KEY);
      return result;
    } catch (err) {
      this.logger.error(`[AiService] Validation error: ${err}`, err);
      // Invalidate health cache on error too
      await this.redis.del(AI_HEALTH_KEY);
      return {
        status: false,
        data: String((err as Error)?.message ?? err),
      };
    }
  }

  async checkHealth(userId?: string): Promise<{
    operational: boolean;
    reason?: string;
    byokRequired?: boolean;
    userKeyConfigured?: boolean;
  }> {
    const byok =
      (await this.readConfigValue('SYSTEM_AGENT_OWN_KEY')) === 'true';

    if (byok) {
      if (!userId) {
        return {
          operational: false,
          reason: 'BYOK ativo exige usuário',
          byokRequired: true,
          userKeyConfigured: false,
        };
      }
      // Operational when the user has configured enough to build their provider
      // (provider + key, or base URL for OpenAI-compatible). No network call.
      try {
        await this.resolveUserConfig(userId);
        return {
          operational: true,
          byokRequired: true,
          userKeyConfigured: true,
        };
      } catch (err) {
        return {
          operational: false,
          reason: (err as Error).message,
          byokRequired: true,
          userKeyConfigured: false,
        };
      }
    }

    // BYOK off — cache via Redis
    const cached = await this.redis.get(AI_HEALTH_KEY);
    if (cached !== null) {
      return {
        ...(JSON.parse(cached) as { operational: boolean; reason?: string }),
        byokRequired: false,
      };
    }
    const res = await this.validateConfiguration();
    const result = {
      operational: res.status,
      byokRequired: false,
      ...(res.status ? {} : { reason: String(res.data) }),
    };
    await this.redis.set(AI_HEALTH_KEY, JSON.stringify(result), AI_HEALTH_TTL);
    return result;
  }

  async invalidateHealthCache(): Promise<void> {
    await this.redis.del(AI_HEALTH_KEY);
  }

  /** Valida uma configuração candidata, vinda do formulário e ainda não gravada. */
  async validateCandidate(cfg: ResolvedAiConfig): Promise<ProviderResult> {
    try {
      return await this.buildProvider(cfg).validateConfiguration();
    } catch (err) {
      return { status: false, data: String((err as Error)?.message ?? err) };
    }
  }

  /** Lista os modelos de uma configuração candidata, ainda não gravada. */
  async listModelsForCandidate(cfg: ResolvedAiConfig): Promise<string[]> {
    try {
      return await this.buildProvider(cfg).listModels();
    } catch {
      return [];
    }
  }

  async validateUserConfiguration(userId: string): Promise<ProviderResult> {
    try {
      const cfg = await this.resolveUserConfig(userId);
      const result = await this.buildProvider(cfg).validateConfiguration();
      // Invalidate health cache so next checkHealth reflects the new validation state
      await this.redis.del(AI_HEALTH_KEY);
      return result;
    } catch (err) {
      // Invalidate health cache on error too
      await this.redis.del(AI_HEALTH_KEY);
      return { status: false, data: String((err as Error)?.message ?? err) };
    }
  }

  async getModels(
    userId?: string,
  ): Promise<{ models: string[]; default: string }> {
    const byok =
      (await this.readConfigValue('SYSTEM_AGENT_OWN_KEY')) === 'true';
    const cfg = byok
      ? await this.resolveUserConfig(userId)
      : await this.resolveSystemConfig();
    const provider = this.buildProvider(cfg);
    let models: string[] = [];
    try {
      models = await provider.listModels();
    } catch {
      models = [];
    }
    if (cfg.model && !models.includes(cfg.model))
      models = [cfg.model, ...models];
    return { models, default: cfg.model };
  }

  private async provider(userId?: string): Promise<IAiProvider> {
    const byok =
      (await this.readConfigValue('SYSTEM_AGENT_OWN_KEY')) === 'true';

    this.logger.log(`[AiService.provider] byok=${byok}, userId=${userId}`);

    const cfg = byok
      ? await this.resolveUserConfig(userId)
      : await this.resolveSystemConfig();

    return this.buildProvider(cfg);
  }

  // Platform-wide config (SYSTEM_AI_*). Used when BYOK is off.
  private async resolveSystemConfig(): Promise<ResolvedAiConfig> {
    const engine =
      (await this.readConfigValue('SYSTEM_AI_PROVIDER')) ??
      AiProviderConst.ANTHROPIC;
    // Mesma chave pros 3 engines — não faz sentido por provider (é um teto de
    // saída, não uma capacidade específica do modelo).
    const maxTokens = parseMaxTokens(
      await this.readConfigValue('SYSTEM_AI_MAX_TOKENS'),
    );

    switch (engine) {
      case AiProviderConst.ANTHROPIC: {
        const apiKey = await this.readConfigValue(
          'SYSTEM_AI_ANTHROPIC_API_KEY',
        );
        if (!apiKey)
          throw new AiNotConfiguredError('Chave Anthropic não configurada');
        const model =
          (await this.readConfigValue('SYSTEM_AI_ANTHROPIC_MODEL')) ??
          'claude-sonnet-4-20250514';
        return { engine, apiKey, model, maxTokens };
      }
      case AiProviderConst.OPENAI: {
        const apiKey = await this.readConfigValue('SYSTEM_AI_OPENAI_API_KEY');
        if (!apiKey)
          throw new AiNotConfiguredError('Chave OpenAI não configurada');
        const model =
          (await this.readConfigValue('SYSTEM_AI_OPENAI_MODEL')) ?? 'gpt-4o';
        return { engine, apiKey, model, maxTokens };
      }
      case AiProviderConst.OPENAI_COMPATIBLE: {
        const baseUrl = await this.readConfigValue(
          'SYSTEM_AI_OPENAI_COMPATIBLE_BASE_URL',
        );
        if (!baseUrl)
          throw new AiNotConfiguredError(
            'BASE_URL do provider OpenAI Compatible não configurada',
          );
        // API key opcional para Ollama/LM Studio — provider usa 'not-needed' se vazia
        const apiKey =
          (await this.readConfigValue('SYSTEM_AI_OPENAI_COMPATIBLE_API_KEY')) ??
          '';
        const model =
          (await this.readConfigValue('SYSTEM_AI_OPENAI_COMPATIBLE_MODEL')) ??
          '';
        return { engine, apiKey, model, baseUrl, maxTokens };
      }
      default:
        throw new AiNotConfiguredError(`Provider desconhecido: ${engine}`);
    }
  }

  // Per-user config (USERCONFIG_AGENT_*). Used when BYOK is on — the user
  // brings their own provider, model, base URL and key.
  private async resolveUserConfig(userId?: string): Promise<ResolvedAiConfig> {
    if (!userId) throw new AiNotConfiguredError('BYOK ativo exige usuário');

    const engine =
      (await this.readUserValue(userId, 'USERCONFIG_AGENT_PROVIDER')) ??
      AiProviderConst.ANTHROPIC;
    // Chaves do provider ativo — o usuário pode ter credencial guardada para mais de um
    // (mesmo esquema do lado da plataforma). Provider fora do enum cai no default abaixo.
    const keys = USER_AI_CONFIG_KEYS[engine as AiProvider];
    const apiKey = keys ? await this.readUserValue(userId, keys.apiKey) : null;
    const model = keys ? await this.readUserValue(userId, keys.model) : null;
    const baseUrl = keys?.baseUrl
      ? await this.readUserValue(userId, keys.baseUrl)
      : null;
    const maxTokens = parseMaxTokens(
      await this.readUserValue(userId, 'USERCONFIG_AGENT_MAX_TOKENS'),
    );

    switch (engine) {
      case AiProviderConst.ANTHROPIC:
        if (!apiKey)
          throw new AiNotConfiguredError('Usuário sem chave configurada');
        return {
          engine,
          apiKey,
          model: model ?? 'claude-sonnet-4-20250514',
          maxTokens,
        };
      case AiProviderConst.OPENAI:
        if (!apiKey)
          throw new AiNotConfiguredError('Usuário sem chave configurada');
        return { engine, apiKey, model: model ?? 'gpt-4o', maxTokens };
      case AiProviderConst.OPENAI_COMPATIBLE:
        if (!baseUrl)
          throw new AiNotConfiguredError('Usuário sem BASE_URL configurada');
        return {
          engine,
          apiKey: apiKey ?? '',
          model: model ?? '',
          baseUrl,
          maxTokens,
        };
      default:
        throw new AiNotConfiguredError(`Provider desconhecido: ${engine}`);
    }
  }

  private buildProvider(cfg: ResolvedAiConfig): IAiProvider {
    switch (cfg.engine) {
      case AiProviderConst.ANTHROPIC: {
        const dto = new AnthropicConfigDto();
        dto.apiKey = cfg.apiKey;
        dto.model = cfg.model;
        return this.anthropic.use(dto);
      }
      case AiProviderConst.OPENAI: {
        const dto = new OpenAiConfigDto();
        dto.apiKey = cfg.apiKey;
        dto.model = cfg.model;
        return this.openai.use(dto);
      }
      case AiProviderConst.OPENAI_COMPATIBLE: {
        const dto = new OpenAiCompatibleConfigDto();
        dto.baseUrl = cfg.baseUrl ?? '';
        dto.apiKey = cfg.apiKey;
        dto.model = cfg.model;
        return this.openaiCompatible.use(dto);
      }
      default:
        throw new AiNotConfiguredError(`Provider desconhecido: ${cfg.engine}`);
    }
  }

  private async readUserValue(
    userId: string,
    labelKey: string,
  ): Promise<string | null> {
    const value: unknown =
      await this.userConfigService.getDecryptedValueForUser(userId, labelKey);
    if (typeof value === 'string') return value === '' ? null : value;
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return null;
  }

  // findByLabelKey throws NotFoundException when key missing — catch and return null for graceful fallback
  // findByLabelKey converts BOOLEAN values to boolean; String() normalizes before comparison
  private async readConfigValue(labelKey: string): Promise<string | null> {
    try {
      const record = await this.systemConfig.findByLabelKey(labelKey);
      const raw = record?.value;
      if (raw == null) return null;
      // `value` é tipado como `number | string | boolean | object` (valueType JSON
      // é uma opção real): serializa em vez de virar "[object Object]".
      return typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
    } catch (err) {
      if (err instanceof NotFoundException) return null;
      throw err;
    }
  }
}
