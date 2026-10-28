import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OpenAiCompatibleProvider,
  WAF_BYPASS_HEADERS,
} from './openai-compatible.provider';

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);

describe('OpenAiCompatibleProvider', () => {
  const provider = new OpenAiCompatibleProvider();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('use()', () => {
    // A construção do modelo (baseURL + WAF headers + streamUsage:false) mora
    // agora em `AiService.getChatModel`, que monta o ChatOpenAI com estes
    // headers — ver ai.service.spec.
    it('exposes only validate and listModels', () => {
      const result = provider.use({
        apiKey: 'test-key',
        model: 'gpt-4',
        baseUrl: 'http://localhost:11434/v1',
      });
      expect(result.validateConfiguration).toBeTypeOf('function');
      expect(result.listModels).toBeTypeOf('function');
      expect((result as { chat?: unknown }).chat).toBeUndefined();
    });

    // WAF/Cloudflare devolve 403 para o User-Agent do SDK — o header precisa
    // continuar sendo neutralizado, seja quem for que monte o cliente.
    it('keeps neutralising the SDK fingerprint headers', () => {
      expect(WAF_BYPASS_HEADERS['User-Agent']).toBe('node-fetch/1.0');
      expect(WAF_BYPASS_HEADERS['X-Stainless-Lang']).toBeNull();
    });
  });

  describe('validateConfiguration', () => {
    it('should return status true if models.list succeeds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });
      const providerInstance = provider.use({
        apiKey: 'test-key',
        model: 'gpt-4',
        baseUrl: 'http://localhost:11434/v1',
      });
      const result = await providerInstance.validateConfiguration();
      expect(result).toEqual({ status: true, data: 'API key valid' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should return status true if models.list fails but chat minimum succeeds', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: 'pong' } }] }),
        });

      const providerInstance = provider.use({
        apiKey: 'test-key',
        model: 'gpt-4',
        baseUrl: 'http://localhost:11434/v1',
      });
      const result = await providerInstance.validateConfiguration();
      expect(result).toEqual({
        status: true,
        data: 'endpoint reachable (200)',
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return status false if both models.list and chat minimum fail', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Connection refused' } }),
          headers: { get: () => 'application/json' },
        });

      const providerInstance = provider.use({
        apiKey: 'test-key',
        model: 'gpt-4',
        baseUrl: 'http://localhost:11434/v1',
      });
      const result = await providerInstance.validateConfiguration();
      expect(result).toEqual({
        status: false,
        data: '500 Connection refused',
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('listModels', () => {
    it('should return sorted model list on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'model-b' }, { id: 'model-a' }] }),
      });
      const providerInstance = provider.use({
        apiKey: 'test-key',
        model: 'gpt-4',
        baseUrl: 'http://localhost:11434/v1',
      });
      const models = await providerInstance.listModels();
      expect(models).toEqual(['model-a', 'model-b']);
    });

    it('should return empty array on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const providerInstance = provider.use({
        apiKey: 'test-key',
        model: 'gpt-4',
        baseUrl: 'http://localhost:11434/v1',
      });
      const models = await providerInstance.listModels();
      expect(models).toEqual([]);
    });

    it('should return empty array on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });
      const providerInstance = provider.use({
        apiKey: 'test-key',
        model: 'gpt-4',
        baseUrl: 'http://localhost:11434/v1',
      });
      const models = await providerInstance.listModels();
      expect(models).toEqual([]);
    });
  });
});
