import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AiService, AiNotConfiguredError } from './ai.service';
import type { IAiProvider } from 'src/domain/interface/ai-provider.interface';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import { RedisService } from 'src/common/infrastructure/redis/redis.service';
import { UserConfigurationService } from 'src/modules/user-configuration/user-configuration.service';
import { AnthropicAiProvider } from './providers/anthropic.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import { ToolRegistry } from './tool-registry.service';

// O provider não fala mais com o modelo — `getChatModel()` monta o
// BaseChatModel do LangChain direto. Estes mocks são o que a resolução de
// config (plataforma vs BYOK) tem que acertar.
const { MockChatAnthropic, MockChatOpenAI } = vi.hoisted(() => ({
  MockChatAnthropic: vi.fn().mockImplementation(() => ({ _type: 'anthropic' })),
  MockChatOpenAI: vi.fn().mockImplementation(() => ({ _type: 'openai' })),
}));

vi.mock('@langchain/anthropic', () => ({ ChatAnthropic: MockChatAnthropic }));
vi.mock('@langchain/openai', () => ({ ChatOpenAI: MockChatOpenAI }));

const makeMockProvider = (): IAiProvider => ({
  validateConfiguration: vi
    .fn()
    .mockResolvedValue({ status: true, data: 'ok' }),
  listModels: vi.fn().mockResolvedValue([]),
});

const mockAnthropicUse = vi.fn();
const mockOpenaiUse = vi.fn();
const mockOpenaiCompatibleUse = vi.fn();
const mockSysConfig = { findByLabelKey: vi.fn() };
const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
};
const mockUserConfig = {
  getDecryptedValueForUser: vi.fn().mockResolvedValue(null),
};
const mockToolRegistry = {
  getToolDefinitions: vi.fn().mockResolvedValue([]),
  getToolGroup: vi.fn().mockReturnValue('other'),
};

describe('AiService', () => {
  let service: AiService;
  let anthropicProvider: IAiProvider;
  let openaiProvider: IAiProvider;
  let openaiCompatibleProvider: IAiProvider;

  beforeEach(async () => {
    anthropicProvider = makeMockProvider();
    openaiProvider = makeMockProvider();
    openaiCompatibleProvider = makeMockProvider();
    mockAnthropicUse.mockReturnValue(anthropicProvider);
    mockOpenaiUse.mockReturnValue(openaiProvider);
    mockOpenaiCompatibleUse.mockReturnValue(openaiCompatibleProvider);
    // Sem isso, `toHaveBeenCalledWith` passaria por chamada de um teste
    // anterior — e `not.toHaveBeenCalled` nunca passaria.
    MockChatAnthropic.mockClear();
    MockChatOpenAI.mockClear();
    mockSysConfig.findByLabelKey.mockReset();
    mockRedis.get.mockReset().mockResolvedValue(null);
    mockRedis.set.mockReset().mockResolvedValue(undefined);
    mockRedis.del.mockReset().mockResolvedValue(undefined);
    mockUserConfig.getDecryptedValueForUser.mockReset().mockResolvedValue(null);
    mockToolRegistry.getToolDefinitions.mockReset().mockResolvedValue([]);
    mockToolRegistry.getToolGroup.mockReset().mockReturnValue('other');

    const { Test } = await import('@nestjs/testing');
    const module = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AnthropicAiProvider, useValue: { use: mockAnthropicUse } },
        { provide: OpenAiProvider, useValue: { use: mockOpenaiUse } },
        {
          provide: OpenAiCompatibleProvider,
          useValue: { use: mockOpenaiCompatibleUse },
        },
        { provide: SystemConfigurationService, useValue: mockSysConfig },
        { provide: RedisService, useValue: mockRedis },
        { provide: UserConfigurationService, useValue: mockUserConfig },
        { provide: ToolRegistry, useValue: mockToolRegistry },
      ],
    }).compile();

    service = module.get(AiService);
  });

  describe('getChatModel — resolução de provider', () => {
    it('resolves Anthropic by default', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_ANTHROPIC_API_KEY') return { value: 'sk-test' };
        return null;
      });

      await service.getChatModel();

      expect(MockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'sk-test' }),
      );
      expect(MockChatOpenAI).not.toHaveBeenCalled();
    });

    it('resolves engine by SYSTEM_AI_PROVIDER', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_PROVIDER') return { value: 'OPENAI' };
        if (key === 'SYSTEM_AI_OPENAI_API_KEY') return { value: 'sk-test' };
        if (key === 'SYSTEM_AI_OPENAI_MODEL') return { value: 'gpt-4o' };
        return null;
      });

      await service.getChatModel();

      expect(MockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'sk-test', model: 'gpt-4o' }),
      );
    });

    // O gateway compatible precisa de baseURL, dos headers que driblam o WAF e
    // de streamUsage desligado — se algum sumir, o gateway devolve 403 ou
    // rejeita a extensão `stream_options`.
    it('resolves OPENAI_COMPATIBLE with baseURL, WAF headers and no stream usage', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_PROVIDER') return { value: 'OPENAI_COMPATIBLE' };
        if (key === 'SYSTEM_AI_OPENAI_COMPATIBLE_BASE_URL') return { value: 'http://localhost:8080' };
        if (key === 'SYSTEM_AI_OPENAI_COMPATIBLE_API_KEY') return { value: 'sk-test' };
        if (key === 'SYSTEM_AI_OPENAI_COMPATIBLE_MODEL') return { value: 'custom-model' };
        return null;
      });

      await service.getChatModel();

      expect(MockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'custom-model',
          streamUsage: false,
          configuration: expect.objectContaining({
            baseURL: 'http://localhost:8080',
            defaultHeaders: expect.objectContaining({
              'User-Agent': 'node-fetch/1.0',
            }),
          }),
        }),
      );
    });

    it('lets the caller override the configured model', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_ANTHROPIC_API_KEY') return { value: 'sk-test' };
        if (key === 'SYSTEM_AI_ANTHROPIC_MODEL') return { value: 'claude-padrao' };
        return null;
      });

      await service.getChatModel(undefined, 'claude-escolhido-na-ui');

      expect(MockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-escolhido-na-ui' }),
      );
    });

    it('throws AiNotConfiguredError when API key missing', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_PROVIDER') return { value: 'ANTHROPIC' };
        return null;
      });

      await expect(service.getChatModel()).rejects.toThrow(
        AiNotConfiguredError,
      );
    });

    // maxTokens deixou de ser configurável por chamada na migração pro
    // LangChain (hardcoded em 4096) — restaurado como config de plataforma/
    // usuário, mesma chave livre que model/apiKey já usam.
    it('reads SYSTEM_AI_MAX_TOKENS and passes it through to the chat model', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_ANTHROPIC_API_KEY') return { value: 'sk-test' };
        if (key === 'SYSTEM_AI_MAX_TOKENS') return { value: '8000' };
        return null;
      });

      await service.getChatModel();

      expect(MockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({ maxTokens: 8000 }),
      );
    });

    it('falls back to the provider default when SYSTEM_AI_MAX_TOKENS is absent or invalid', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_ANTHROPIC_API_KEY') return { value: 'sk-test' };
        if (key === 'SYSTEM_AI_MAX_TOKENS') return { value: 'não é número' };
        return null;
      });

      await service.getChatModel();

      expect(MockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({ maxTokens: 4096 }),
      );
    });
  });

  describe('BYOK', () => {
    it('throws AiNotConfiguredError when BYOK on and no userId', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_PROVIDER') return { value: 'ANTHROPIC' };
        if (key === 'SYSTEM_AGENT_OWN_KEY') return { value: 'true' };
        return null;
      });

      await expect(service.getChatModel()).rejects.toThrow(
        AiNotConfiguredError,
      );
    });

    it('throws AiNotConfiguredError when BYOK on and no user key', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_PROVIDER') return { value: 'ANTHROPIC' };
        if (key === 'SYSTEM_AGENT_OWN_KEY') return { value: 'true' };
        return null;
      });
      mockUserConfig.getDecryptedValueForUser.mockResolvedValue(null);

      await expect(service.getChatModel('user123')).rejects.toThrow(
        AiNotConfiguredError,
      );

      expect(mockUserConfig.getDecryptedValueForUser).toHaveBeenCalledWith(
        'user123',
        'USERCONFIG_AGENT_ANTHROPIC_API_KEY',
      );
    });

    it('uses user key when BYOK on and key exists', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AGENT_OWN_KEY') return { value: 'true' };
        return null;
      });
      mockUserConfig.getDecryptedValueForUser.mockImplementation(
        (_uid: string, key: string) =>
          Promise.resolve(
            key === 'USERCONFIG_AGENT_ANTHROPIC_API_KEY' ? 'sk-user-key' : null,
          ),
      );

      await service.getChatModel('user123');

      expect(mockUserConfig.getDecryptedValueForUser).toHaveBeenCalledWith(
        'user123',
        'USERCONFIG_AGENT_ANTHROPIC_API_KEY',
      );
      expect(MockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'sk-user-key' }),
      );
    });

    it('resolves the user-selected provider/model/key when BYOK on', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        // Platform provider is ANTHROPIC, but the user picks OPENAI — user wins
        if (key === 'SYSTEM_AI_PROVIDER') return { value: 'ANTHROPIC' };
        if (key === 'SYSTEM_AGENT_OWN_KEY') return { value: 'true' };
        return null;
      });
      mockUserConfig.getDecryptedValueForUser.mockImplementation(
        (_uid: string, key: string) => {
          const map: Record<string, string> = {
            USERCONFIG_AGENT_PROVIDER: 'OPENAI',
            USERCONFIG_AGENT_OPENAI_MODEL: 'gpt-4o-mini',
            USERCONFIG_AGENT_OPENAI_API_KEY: 'sk-user-openai',
            // Credencial de outro provider fica guardada e é ignorada: é o ponto do
            // conjunto de chaves por provider.
            USERCONFIG_AGENT_ANTHROPIC_API_KEY: 'sk-ant-do-usuario',
          };
          return Promise.resolve(map[key] ?? null);
        },
      );

      await service.getChatModel('user123');

      expect(MockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'sk-user-openai', model: 'gpt-4o-mini' }),
      );
      expect(MockChatAnthropic).not.toHaveBeenCalled();
    });

    it('reads USERCONFIG_AGENT_MAX_TOKENS and passes it through when BYOK on', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AGENT_OWN_KEY') return { value: 'true' };
        return null;
      });
      mockUserConfig.getDecryptedValueForUser.mockImplementation(
        (_uid: string, key: string) => {
          const map: Record<string, string> = {
            USERCONFIG_AGENT_ANTHROPIC_API_KEY: 'sk-user-key',
            USERCONFIG_AGENT_MAX_TOKENS: '2000',
          };
          return Promise.resolve(map[key] ?? null);
        },
      );

      await service.getChatModel('user123');

      expect(MockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({ maxTokens: 2000 }),
      );
    });

    it('resolves OPENAI_COMPATIBLE from the user base URL when BYOK on', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AGENT_OWN_KEY') return { value: 'true' };
        return null;
      });
      mockUserConfig.getDecryptedValueForUser.mockImplementation(
        (_uid: string, key: string) => {
          const map: Record<string, string> = {
            USERCONFIG_AGENT_PROVIDER: 'OPENAI_COMPATIBLE',
            USERCONFIG_AGENT_OPENAI_COMPATIBLE_BASE_URL:
              'http://localhost:11434/v1',
            USERCONFIG_AGENT_OPENAI_COMPATIBLE_MODEL: 'llama3',
          };
          return Promise.resolve(map[key] ?? null);
        },
      );

      await service.getChatModel('user123');

      // Sem chave do usuário: provider compatible (Ollama/LM Studio) aceita
      // 'not-needed'.
      expect(MockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'not-needed',
          model: 'llama3',
          configuration: expect.objectContaining({
            baseURL: 'http://localhost:11434/v1',
          }),
        }),
      );
    });
  });

  describe('validateConfiguration', () => {
    it('returns status from platform provider', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_PROVIDER') return { value: 'ANTHROPIC' };
        if (key === 'SYSTEM_AI_ANTHROPIC_API_KEY') return { value: 'sk-test' };
        return null;
      });

      const result = await service.validateConfiguration();
      expect(result).toEqual({ status: true, data: 'ok' });
    });

    it('returns error status on exception', async () => {
      mockSysConfig.findByLabelKey.mockRejectedValue(new NotFoundException());

      const result = await service.validateConfiguration();
      expect(result.status).toBe(false);
    });

    it('BYOK ligado sem userId (chamada de sistema) recusa em vez de usar a config da plataforma', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) =>
        key === 'SYSTEM_AGENT_OWN_KEY' ? { value: 'true' } : null,
      );

      const result = await service.validateConfiguration();
      expect(result.status).toBe(false);
      expect(result.data).toContain('BYOK ativo exige usuário');
    });
  });

  describe('checkHealth', () => {
    it('returns cached result when BYOK off', async () => {
      mockSysConfig.findByLabelKey.mockResolvedValue(null);
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ operational: true }),
      );

      const result = await service.checkHealth();
      expect(result).toEqual({ operational: true, byokRequired: false });
    });

    it('validates and caches when no cache (BYOK off)', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_PROVIDER') return { value: 'ANTHROPIC' };
        if (key === 'SYSTEM_AI_ANTHROPIC_API_KEY') return { value: 'sk-test' };
        return null;
      });

      const result = await service.checkHealth();
      expect(result.operational).toBe(true);
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('returns operational=false when BYOK on and no user key', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AGENT_OWN_KEY') return { value: 'true' };
        return null;
      });
      mockUserConfig.getDecryptedValueForUser.mockResolvedValue(null);

      const result = await service.checkHealth('user123');
      expect(result.operational).toBe(false);
      expect(result.byokRequired).toBe(true);
      expect(result.userKeyConfigured).toBe(false);
    });

    it('returns operational=true when BYOK on and user has key', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AGENT_OWN_KEY') return { value: 'true' };
        return null;
      });
      mockUserConfig.getDecryptedValueForUser.mockImplementation(
        (_uid: string, key: string) =>
          Promise.resolve(
            key === 'USERCONFIG_AGENT_ANTHROPIC_API_KEY' ? 'sk-user' : null,
          ),
      );

      const result = await service.checkHealth('user123');
      expect(result.operational).toBe(true);
      expect(result.byokRequired).toBe(true);
      expect(result.userKeyConfigured).toBe(true);
    });

    it('returns operational=false when BYOK on and no userId', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AGENT_OWN_KEY') return { value: 'true' };
        return null;
      });

      const result = await service.checkHealth();
      expect(result.operational).toBe(false);
      expect(result.byokRequired).toBe(true);
      expect(result.userKeyConfigured).toBe(false);
    });
  });

  describe('buildSystemPrompt', () => {
    it('always includes the baseline prompt, even with no configs', async () => {
      mockSysConfig.findByLabelKey.mockResolvedValue(null);
      mockUserConfig.getDecryptedValueForUser.mockResolvedValue(null);

      const prompt = await service.buildSystemPrompt('user123');
      expect(prompt).toContain('não tem permissão para essa ação');
    });

    it('appends the global admin prompt when configured', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_SYSTEM_PROMPT') return { value: 'Seja formal.' };
        return null;
      });
      mockUserConfig.getDecryptedValueForUser.mockResolvedValue(null);

      const prompt = await service.buildSystemPrompt('user123');
      expect(prompt).toContain('Seja formal.');
    });

    it('appends the per-user prompt when configured', async () => {
      mockSysConfig.findByLabelKey.mockResolvedValue(null);
      mockUserConfig.getDecryptedValueForUser.mockImplementation(
        (_uid: string, key: string) =>
          Promise.resolve(key === 'USERCONFIG_AGENT_PROMPT' ? 'Responda em inglês.' : null),
      );

      const prompt = await service.buildSystemPrompt('user123');
      expect(prompt).toContain('Responda em inglês.');
    });

    it('appends the open page when informed, and omits it otherwise', async () => {
      mockSysConfig.findByLabelKey.mockResolvedValue(null);
      mockUserConfig.getDecryptedValueForUser.mockResolvedValue(null);

      const withPage = await service.buildSystemPrompt('user123', {
        page: '/users?tab=roles',
      });
      expect(withPage).toContain('/users?tab=roles');

      const withoutPage = await service.buildSystemPrompt('user123');
      expect(withoutPage).not.toContain('aberta no aplicativo');
    });

    it('turns what is mounted on screen into the matching tool names', async () => {
      mockSysConfig.findByLabelKey.mockResolvedValue(null);
      mockUserConfig.getDecryptedValueForUser.mockResolvedValue(null);
      // Só o que o role permite chega aqui — é a mesma lista que o modelo recebe.
      mockToolRegistry.getToolDefinitions.mockResolvedValue([
        { name: 'list_users', description: '', inputSchema: {} },
        { name: 'list_logging', description: '', inputSchema: {} },
      ]);
      mockToolRegistry.getToolGroup.mockImplementation((name: string) =>
        name === 'list_users' ? 'user' : 'logging',
      );

      const prompt = await service.buildSystemPrompt('user123', {
        roleName: 'ADMIN',
        items: [
          { kind: 'collection', source: 'users' },
          { kind: 'config', source: 'system-configuration', detail: 'SYSTEM_AI_ANTHROPIC_MODEL' },
        ],
      });

      expect(prompt).toContain('SYSTEM_AI_ANTHROPIC_MODEL');
      expect(prompt).toContain('list_users');
      // Tool de outro domínio não entra só por estar disponível ao role.
      expect(prompt).not.toContain('list_logging');
    });

    it('still names a source outside the map, but suggests no tool for it', async () => {
      mockSysConfig.findByLabelKey.mockResolvedValue(null);
      mockUserConfig.getDecryptedValueForUser.mockResolvedValue(null);
      mockToolRegistry.getToolDefinitions.mockResolvedValue([
        { name: 'list_users', description: '', inputSchema: {} },
      ]);
      mockToolRegistry.getToolGroup.mockReturnValue('user');

      const prompt = await service.buildSystemPrompt('user123', {
        roleName: 'ADMIN',
        items: [{ kind: 'collection', source: 'modulo-novo' }],
      });

      expect(prompt).toContain('modulo-novo');
      expect(prompt).not.toContain('ferramentas desse domínio');
    });

    it('omits the screen block entirely when there is nothing mounted', async () => {
      mockSysConfig.findByLabelKey.mockResolvedValue(null);
      mockUserConfig.getDecryptedValueForUser.mockResolvedValue(null);

      const prompt = await service.buildSystemPrompt('user123', {
        roleName: 'ADMIN',
        items: [],
      });

      expect(prompt).not.toContain('está vendo isto na tela');
    });

    it('falls back to just the baseline when config lookups throw', async () => {
      mockSysConfig.findByLabelKey.mockRejectedValue(new NotFoundException());
      mockUserConfig.getDecryptedValueForUser.mockRejectedValue(new NotFoundException());

      const prompt = await service.buildSystemPrompt('user123');
      expect(prompt).toContain('não tem permissão para essa ação');
    });
  });

  describe('invalidateHealthCache', () => {
    it('deletes the health key from Redis', async () => {
      await service.invalidateHealthCache();
      expect(mockRedis.del).toHaveBeenCalledWith('ai:health');
    });
  });

  describe('getChatModel — OPENAI com maxTokens', () => {
    it('reads SYSTEM_AI_MAX_TOKENS for the OPENAI engine too', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_PROVIDER') return { value: 'OPENAI' };
        if (key === 'SYSTEM_AI_OPENAI_API_KEY') return { value: 'sk-test' };
        if (key === 'SYSTEM_AI_MAX_TOKENS') return { value: '2048' };
        return null;
      });

      await service.getChatModel();

      expect(MockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({ maxTokens: 2048 }),
      );
    });
  });

  describe('resolveSystemConfig — engines além do default', () => {
    it('OPENAI_COMPATIBLE sem BASE_URL recusa', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_PROVIDER') return { value: 'OPENAI_COMPATIBLE' };
        return null;
      });

      await expect(service.validateConfiguration()).resolves.toMatchObject({
        status: false,
      });
    });

    it('OPENAI_COMPATIBLE com BASE_URL mas sem key/model usa string vazia', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_PROVIDER') return { value: 'OPENAI_COMPATIBLE' };
        if (key === 'SYSTEM_AI_OPENAI_COMPATIBLE_BASE_URL') return { value: 'http://x:8080' };
        return null;
      });

      await service.getChatModel();

      expect(MockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'not-needed', model: '' }),
      );
    });

    it('provider totalmente desconhecido recusa', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_PROVIDER') return { value: 'BOGUS' };
        return null;
      });

      await expect(service.getChatModel()).rejects.toThrow(
        AiNotConfiguredError,
      );
    });
  });

  describe('resolveUserConfig — provider desconhecido (BYOK)', () => {
    it('recusa quando o usuário escolheu um provider que não existe', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) =>
        key === 'SYSTEM_AGENT_OWN_KEY' ? { value: 'true' } : null,
      );
      mockUserConfig.getDecryptedValueForUser.mockImplementation(
        (_uid: string, key: string) =>
          Promise.resolve(key === 'USERCONFIG_AGENT_PROVIDER' ? 'BOGUS' : null),
      );

      await expect(service.getChatModel('user123')).rejects.toThrow(
        AiNotConfiguredError,
      );
    });
  });

  describe('readUserValue — valor guardado como número/boolean', () => {
    it('converte para string antes de usar como chave/modelo', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) =>
        key === 'SYSTEM_AGENT_OWN_KEY' ? { value: 'true' } : null,
      );
      mockUserConfig.getDecryptedValueForUser.mockImplementation(
        (_uid: string, key: string) => {
          if (key === 'USERCONFIG_AGENT_ANTHROPIC_API_KEY') return Promise.resolve('sk-user');
          if (key === 'USERCONFIG_AGENT_MAX_TOKENS') return Promise.resolve(4096);
          return Promise.resolve(null);
        },
      );

      await service.getChatModel('user123');

      expect(MockChatAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({ maxTokens: 4096 }),
      );
    });
  });

  describe('readConfigValue — erro real propaga', () => {
    it('erro que não é NotFoundException propaga', async () => {
      mockSysConfig.findByLabelKey.mockRejectedValue(new Error('db fora'));

      const result = await service.validateConfiguration();
      expect(result).toEqual({ status: false, data: 'db fora' });
    });
  });

  describe('validateCandidate', () => {
    it('valida uma config OPENAI ainda não gravada', async () => {
      const result = await service.validateCandidate({
        engine: 'OPENAI',
        apiKey: 'sk-x',
        model: 'gpt-4o',
      });
      expect(result).toEqual({ status: true, data: 'ok' });
      expect(mockOpenaiUse).toHaveBeenCalled();
    });

    it('valida uma config OPENAI_COMPATIBLE ainda não gravada', async () => {
      const result = await service.validateCandidate({
        engine: 'OPENAI_COMPATIBLE',
        apiKey: '',
        model: 'llama3',
        baseUrl: 'http://localhost:11434/v1',
      });
      expect(result).toEqual({ status: true, data: 'ok' });
      expect(mockOpenaiCompatibleUse).toHaveBeenCalled();
    });

    it('devolve status=false quando o provider rejeita a candidata', async () => {
      anthropicProvider.validateConfiguration = vi
        .fn()
        .mockRejectedValue(new Error('bad key'));

      const result = await service.validateCandidate({
        engine: 'ANTHROPIC',
        apiKey: 'sk-bad',
        model: 'claude-x',
      });
      expect(result).toEqual({ status: false, data: 'bad key' });
    });

    it('engine desconhecido (form submetido sem validação prévia) devolve status=false', async () => {
      const result = await service.validateCandidate({
        engine: 'BOGUS' as never,
        apiKey: 'x',
        model: 'y',
      });
      expect(result).toEqual({
        status: false,
        data: 'Provider desconhecido: BOGUS',
      });
    });
  });

  describe('listModelsForCandidate', () => {
    it('lista os modelos da config candidata', async () => {
      anthropicProvider.listModels = vi.fn().mockResolvedValue(['claude-a', 'claude-b']);
      const models = await service.listModelsForCandidate({
        engine: 'ANTHROPIC',
        apiKey: 'sk-x',
        model: 'claude-a',
      });
      expect(models).toEqual(['claude-a', 'claude-b']);
    });

    it('devolve lista vazia quando o provider falha', async () => {
      anthropicProvider.listModels = vi.fn().mockRejectedValue(new Error('fora do ar'));
      const models = await service.listModelsForCandidate({
        engine: 'ANTHROPIC',
        apiKey: 'sk-x',
        model: 'claude-a',
      });
      expect(models).toEqual([]);
    });
  });

  describe('validateUserConfiguration', () => {
    it('valida a config do usuário e invalida o cache de health', async () => {
      mockUserConfig.getDecryptedValueForUser.mockImplementation(
        (_uid: string, key: string) =>
          Promise.resolve(key === 'USERCONFIG_AGENT_ANTHROPIC_API_KEY' ? 'sk-user' : null),
      );

      const result = await service.validateUserConfiguration('user123');

      expect(result).toEqual({ status: true, data: 'ok' });
      expect(mockRedis.del).toHaveBeenCalledWith('ai:health');
    });

    it('devolve status=false e também invalida o cache quando falha', async () => {
      mockUserConfig.getDecryptedValueForUser.mockResolvedValue(null);

      const result = await service.validateUserConfiguration('user123');

      expect(result.status).toBe(false);
      expect(mockRedis.del).toHaveBeenCalledWith('ai:health');
    });
  });

  describe('getModels', () => {
    it('inclui o modelo configurado quando o provider não o lista', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_ANTHROPIC_API_KEY') return { value: 'sk-test' };
        if (key === 'SYSTEM_AI_ANTHROPIC_MODEL') return { value: 'claude-especial' };
        return null;
      });
      anthropicProvider.listModels = vi.fn().mockResolvedValue(['claude-outro']);

      const result = await service.getModels();

      expect(result.models).toEqual(['claude-especial', 'claude-outro']);
      expect(result.default).toBe('claude-especial');
    });

    it('não duplica o modelo configurado quando ele já está na lista', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_ANTHROPIC_API_KEY') return { value: 'sk-test' };
        if (key === 'SYSTEM_AI_ANTHROPIC_MODEL') return { value: 'claude-sonnet-4-20250514' };
        return null;
      });
      anthropicProvider.listModels = vi
        .fn()
        .mockResolvedValue(['claude-sonnet-4-20250514']);

      const result = await service.getModels();

      expect(result.models).toEqual(['claude-sonnet-4-20250514']);
    });

    it('lista vazia quando o provider falha ao listar', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_AI_ANTHROPIC_API_KEY') return { value: 'sk-test' };
        return null;
      });
      anthropicProvider.listModels = vi.fn().mockRejectedValue(new Error('fora do ar'));

      const result = await service.getModels();

      expect(result.models).toEqual(['claude-sonnet-4-20250514']);
    });

    it('usa a config do usuário quando BYOK está ligado', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) =>
        key === 'SYSTEM_AGENT_OWN_KEY' ? { value: 'true' } : null,
      );
      mockUserConfig.getDecryptedValueForUser.mockImplementation(
        (_uid: string, key: string) =>
          Promise.resolve(key === 'USERCONFIG_AGENT_ANTHROPIC_API_KEY' ? 'sk-user' : null),
      );
      anthropicProvider.listModels = vi.fn().mockResolvedValue(['claude-x']);

      const result = await service.getModels('user123');

      expect(result.models).toEqual(['claude-sonnet-4-20250514', 'claude-x']);
    });
  });
});
