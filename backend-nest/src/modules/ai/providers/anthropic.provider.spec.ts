import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicAiProvider, buildChatAnthropic } from './anthropic.provider';
import type { AnthropicConfigDto } from '../dto/anthropic-config.dto';

const { MockChatAnthropic } = vi.hoisted(() => ({
  MockChatAnthropic: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@langchain/anthropic', () => ({
  ChatAnthropic: MockChatAnthropic,
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

/** Testa o que o LangChain não cobre: validar credencial, listar modelos e construir o modelo. */
describe('AnthropicAiProvider', () => {
  const cfg: AnthropicConfigDto = { apiKey: 'sk-test', model: 'claude-3-sonnet' };
  const provider = new AnthropicAiProvider();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes only what LangChain does not cover: validate and listModels', () => {
    const result = provider.use(cfg);
    expect(result.validateConfiguration).toBeTypeOf('function');
    expect(result.listModels).toBeTypeOf('function');
    expect((result as { chat?: unknown }).chat).toBeUndefined();
  });

  it('builds the chat model with the given apiKey and model', () => {
    buildChatAnthropic('sk-outra', 'claude-3-opus');

    expect(MockChatAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-outra', model: 'claude-3-opus' }),
    );
  });
});
