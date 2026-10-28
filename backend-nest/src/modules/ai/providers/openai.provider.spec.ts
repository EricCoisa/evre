import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAiProvider, buildChatOpenAI } from './openai.provider';

const { mockList } = vi.hoisted(() => ({ mockList: vi.fn() }));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({ models: { list: mockList } })),
}));

const { MockChatOpenAI } = vi.hoisted(() => ({
  MockChatOpenAI: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: MockChatOpenAI,
}));

/** Testa validar chave, listar modelos e construir o `ChatOpenAI`. */
describe('OpenAiProvider', () => {
  const provider = new OpenAiProvider();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes only validate and listModels', () => {
    const result = provider.use({ apiKey: 'test-key', model: 'gpt-4' });
    expect(result.validateConfiguration).toBeTypeOf('function');
    expect(result.listModels).toBeTypeOf('function');
    expect((result as { chat?: unknown }).chat).toBeUndefined();
  });

  describe('buildChatOpenAI', () => {
    it('reports token usage by default', () => {
      buildChatOpenAI('sk-1', 'gpt-4o');

      expect(MockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-1',
          model: 'gpt-4o',
          streamUsage: true,
        }),
      );
    });

    // `stream_options` é extensão que vários gateways OpenAI-compatible
    // rejeitam — `compat` desliga o pedido de usage por streaming.
    it('omits the usage option and forwards baseURL/headers in compat mode', () => {
      buildChatOpenAI(
        'not-needed',
        'llama',
        { baseURL: 'http://gw/v1', defaultHeaders: { 'User-Agent': 'x' } },
        true,
      );

      expect(MockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          streamUsage: false,
          configuration: {
            baseURL: 'http://gw/v1',
            defaultHeaders: { 'User-Agent': 'x' },
          },
        }),
      );
    });
  });

  describe('validateConfiguration', () => {
    it('should return status true if models.list succeeds', async () => {
      mockList.mockResolvedValue({ data: [] });
      const providerInstance = provider.use({ apiKey: 'test-key', model: 'gpt-4' });
      const result = await providerInstance.validateConfiguration();
      expect(result).toEqual({ status: true, data: 'API key valid' });
    });

    it('should return status false if models.list fails', async () => {
      mockList.mockRejectedValue(new Error('Invalid API key'));
      const providerInstance = provider.use({ apiKey: 'test-key', model: 'gpt-4' });
      const result = await providerInstance.validateConfiguration();
      expect(result).toEqual({ status: false, data: 'Invalid API key' });
    });
  });
});
