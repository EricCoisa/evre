import { describe, it, expect, vi } from 'vitest';
import { AIMessage, AIMessageChunk } from '@langchain/core/messages';
import {
  toLangChainMessages,
  fromLangChainMessages,
  toLangChainTools,
  streamLangChainEvents,
} from './langchain-adapter';
import type { AiChatMessage } from 'src/domain/interface/ai-provider.interface';

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
}

async function* streamOf(chunks: AIMessageChunk[]): AsyncGenerator<AIMessageChunk> {
  for (const c of chunks) yield c;
}

describe('toLangChainMessages', () => {
  it('converts a user message to HumanMessage', () => {
    const [msg] = toLangChainMessages([{ role: 'user', content: 'hello' }]);
    expect(msg.getType()).toBe('human');
    expect(msg.content).toBe('hello');
  });

  it('converts an assistant message with tool calls to AIMessage', () => {
    const [msg] = toLangChainMessages([
      {
        role: 'assistant',
        content: 'checking',
        toolCalls: [{ id: 'tc1', name: 'get_user', input: { id: '1' } }],
      },
    ]);
    expect(msg.getType()).toBe('ai');
    expect(msg.content).toBe('checking');
    expect((msg as any).tool_calls).toEqual([
      { id: 'tc1', name: 'get_user', args: { id: '1' } },
    ]);
  });

  it('converts a tool message to ToolMessage', () => {
    const [msg] = toLangChainMessages([
      { role: 'tool', toolCallId: 'tc1', content: '{"id":1}' },
    ]);
    expect(msg.getType()).toBe('tool');
    expect(msg.content).toBe('{"id":1}');
    expect((msg as any).tool_call_id).toBe('tc1');
  });

  it('prepends a SystemMessage when system is given', () => {
    const result = toLangChainMessages(
      [{ role: 'user', content: 'hi' }],
      'be helpful',
    );
    expect(result[0].getType()).toBe('system');
    expect(result[0].content).toBe('be helpful');
    expect(result[1].getType()).toBe('human');
  });

  it('preserves message order as given — does not reorder tool/assistant pairs', () => {
    // Documenta o limite desta função: ela é um mapper puro, "garbage in, garbage
    // out". Ordenar corretamente (assistant/tool_use antes de tool/tool_result) é
    // responsabilidade de quem monta o AiChatMessage[] antes de chamar isso — hoje
    // run-tool-loop.ts (achado #1 da simulação: grava TOOL antes de ASSISTANT no
    // banco), depois do LG.4/LG.5 o state do grafo, correto por construção.
    const badOrder = toLangChainMessages([
      { role: 'tool', toolCallId: 'tc1', content: 'result' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'tc1', name: 'get_user', input: {} }],
      },
    ]);
    expect(badOrder.map((m) => m.getType())).toEqual(['tool', 'ai']);
  });
});

describe('fromLangChainMessages', () => {
  it('round-trips user/assistant/tool messages through toLangChainMessages and back', () => {
    const original: AiChatMessage[] = [
      { role: 'user', content: 'hello' },
      {
        role: 'assistant',
        content: 'checking',
        toolCalls: [{ id: 'tc1', name: 'get_user', input: { id: '1' } }],
      },
      { role: 'tool', toolCallId: 'tc1', content: '{"id":1}' },
    ];

    const result = fromLangChainMessages(toLangChainMessages(original));

    expect(result).toEqual(original);
  });

  it('drops a leading SystemMessage — system prompt is not part of the graph history', () => {
    const messages = toLangChainMessages(
      [{ role: 'user', content: 'hi' }],
      'be helpful',
    );
    const result = fromLangChainMessages(messages);
    expect(result).toEqual([{ role: 'user', content: 'hi' }]);
  });
});

describe('toLangChainTools', () => {
  it('returns undefined when no tools are given', () => {
    expect(toLangChainTools(undefined)).toBeUndefined();
    expect(toLangChainTools([])).toBeUndefined();
  });

  it('maps AiWireTool[] to LangChain function tool definitions', () => {
    const result = toLangChainTools([
      {
        name: 'get_user',
        description: 'Get user by id',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } } },
      },
    ]);
    expect(result).toEqual([
      {
        type: 'function',
        function: {
          name: 'get_user',
          description: 'Get user by id',
          parameters: { type: 'object', properties: { id: { type: 'string' } } },
        },
      },
    ]);
  });
});

describe('streamLangChainEvents', () => {
  it('yields text deltas as they arrive and done at the end', async () => {
    const events = await collect(
      streamLangChainEvents(
        streamOf([
          new AIMessageChunk({ content: 'Hello' }),
          new AIMessageChunk({ content: ' world' }),
        ]),
      ),
    );
    expect(events).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' world' },
      { type: 'done', usage: undefined },
    ]);
  });

  it('accumulates fragmented tool_call_chunks and yields a single tool_call only after the stream ends', async () => {
    const events = await collect(
      streamLangChainEvents(
        streamOf([
          new AIMessageChunk({
            content: '',
            tool_call_chunks: [
              { index: 0, id: 'call_123', name: 'get_user', args: '' },
            ],
          }),
          new AIMessageChunk({
            content: '',
            tool_call_chunks: [{ index: 0, args: '{"id"' }],
          }),
          new AIMessageChunk({
            content: '',
            tool_call_chunks: [{ index: 0, args: ':"1"}' }],
          }),
        ]),
      ),
    );
    expect(events).toEqual([
      { type: 'tool_call', id: 'call_123', name: 'get_user', input: { id: '1' } },
      { type: 'done', usage: undefined },
    ]);
  });

  it('yields one tool_call event per distinct tool call index', async () => {
    const events = await collect(
      streamLangChainEvents(
        streamOf([
          new AIMessageChunk({
            content: '',
            tool_call_chunks: [
              { index: 0, id: 'call_1', name: 'tool_a', args: '{}' },
              { index: 1, id: 'call_2', name: 'tool_b', args: '{}' },
            ],
          }),
        ]),
      ),
    );
    expect(events.filter((e) => e.type === 'tool_call')).toEqual([
      { type: 'tool_call', id: 'call_1', name: 'tool_a', input: {} },
      { type: 'tool_call', id: 'call_2', name: 'tool_b', input: {} },
    ]);
  });

  it('reports a tool call the parser rejected instead of dropping it silently', async () => {
    const events = await collect(
      streamLangChainEvents(
        streamOf([
          new AIMessageChunk({
            content: 'Vou desativar a flag.',
            tool_call_chunks: [
              {
                index: 0,
                id: 'call_x',
                name: 'update_feature_flag',
                args: 'isto não é json',
              },
            ],
          }),
        ]),
      ),
    );

    expect(events.some((e) => e.type === 'tool_call')).toBe(false);
    expect(events.find((e) => e.type === 'error')?.message).toContain(
      'update_feature_flag',
    );
    // O turno ainda fecha normalmente — erro não substitui o done.
    expect(events.at(-1)).toEqual({ type: 'done', usage: undefined });
  });

  it('keeps dispatching a tool call whose JSON was merely truncated — the registry validates it', async () => {
    const events = await collect(
      streamLangChainEvents(
        streamOf([
          new AIMessageChunk({
            content: '',
            tool_call_chunks: [
              { index: 0, id: 'call_y', name: 'update_feature_flag', args: '{"id": ' },
            ],
          }),
        ]),
      ),
    );

    expect(events.some((e) => e.type === 'tool_call')).toBe(true);
  });

  it('reports a response truncated by the token limit', async () => {
    const events = await collect(
      streamLangChainEvents(
        streamOf([
          new AIMessageChunk({
            content: 'Vou procurar a configuração',
            response_metadata: { finish_reason: 'length' },
          }),
        ]),
      ),
    );

    expect(events.find((e) => e.type === 'error')?.message).toContain('limite de tokens');
  });

  it('stays quiet when the turn ends normally', async () => {
    const events = await collect(
      streamLangChainEvents(
        streamOf([
          new AIMessageChunk({
            content: 'tudo certo',
            response_metadata: { finish_reason: 'stop' },
          }),
        ]),
      ),
    );

    expect(events.some((e) => e.type === 'error')).toBe(false);
  });

  it('normalizes a finish_reason duplicated by chunk merging', async () => {
    const events = await collect(
      streamLangChainEvents(
        streamOf([
          new AIMessageChunk({
            content: 'texto',
            response_metadata: { finish_reason: 'lengthlength' },
          }),
        ]),
      ),
    );

    expect(events.find((e) => e.type === 'error')?.message).toContain('limite de tokens');
  });

  it('recovers a tool call from additional_kwargs when the merge produced none', async () => {
    const events = await collect(
      streamLangChainEvents(
        streamOf([
          new AIMessageChunk({
            content: '',
            additional_kwargs: {
              tool_calls: [
                {
                  id: 'call_raw',
                  type: 'function',
                  function: {
                    name: 'set_user_configurations',
                    arguments: '{"labelKey":"USERCONFIG_THEME","value":"light"}',
                  },
                },
              ],
            },
            response_metadata: { finish_reason: 'tool_callstool_calls' },
          }),
        ]),
      ),
    );

    expect(events.find((e) => e.type === 'tool_call')).toEqual({
      type: 'tool_call',
      id: 'call_raw',
      name: 'set_user_configurations',
      input: { labelKey: 'USERCONFIG_THEME', value: 'light' },
    });
  });

  it('recovers arguments the chunk merge duplicated', async () => {
    const args = '{"labelKey":"USERCONFIG_THEME"}';
    const events = await collect(
      streamLangChainEvents(
        streamOf([
          new AIMessageChunk({
            content: '',
            additional_kwargs: {
              tool_calls: [
                {
                  id: 'call_dup',
                  type: 'function',
                  function: { name: 'get_my_configurations', arguments: args + args },
                },
              ],
            },
            response_metadata: { finish_reason: 'tool_calls' },
          }),
        ]),
      ),
    );

    expect(events.find((e) => e.type === 'tool_call')).toMatchObject({
      input: { labelKey: 'USERCONFIG_THEME' },
    });
  });

  it('surfaces reasoning delivered in the gateway-specific field', async () => {
    const events = await collect(
      streamLangChainEvents(
        streamOf([
          new AIMessageChunk({
            content: '',
            additional_kwargs: { reasoning: 'analisando o pedido...' },
          }),
        ]),
      ),
    );

    expect(events).toContainEqual({
      type: 'reasoning',
      text: 'analisando o pedido...',
    });
  });

  it('falls back to a non-streaming call when the stream yields nothing usable', async () => {
    const retry = vi.fn().mockResolvedValue(
      new AIMessage({
        content: 'Desativando a flag.',
        tool_calls: [
          { id: 'call_ns', name: 'update_feature_flag', args: { enabled: false } },
        ],
      }),
    );

    const events = await collect(
      streamLangChainEvents(
        streamOf([
          new AIMessageChunk({
            content: '',
            response_metadata: { finish_reason: 'tool_callstool_calls' },
          }),
        ]),
        retry,
      ),
    );

    expect(retry).toHaveBeenCalledOnce();
    expect(events).toEqual([
      { type: 'text', text: 'Desativando a flag.' },
      {
        type: 'tool_call',
        id: 'call_ns',
        name: 'update_feature_flag',
        input: { enabled: false },
      },
      { type: 'done', usage: undefined },
    ]);
  });

  it('never spends the extra call when the stream produced something', async () => {
    const retry = vi.fn();

    await collect(
      streamLangChainEvents(
        streamOf([new AIMessageChunk({ content: 'resposta normal' })]),
        retry,
      ),
    );

    expect(retry).not.toHaveBeenCalled();
  });

  it('still closes the turn when the fallback itself fails', async () => {
    const retry = vi.fn().mockRejectedValue(new Error('gateway fora'));

    const events = await collect(
      streamLangChainEvents(streamOf([new AIMessageChunk({ content: '' })]), retry),
    );

    expect(events).toEqual([{ type: 'done', usage: undefined }]);
  });

  /** Reproduz o incidente de produção a partir do trace real, sem assumir a duplicação do `finish_reason`. */
  it('survives the gateway repeating its final chunk — the real production payload', async () => {
    const finalChunk = () =>
      new AIMessageChunk({
        content: '',
        additional_kwargs: {
          tool_calls: [
            {
              id: 'call_prod',
              type: 'function',
              function: {
                name: 'update_feature_flag',
                arguments: '{"key":"AI_AGENT","enabled":false}',
              },
            },
          ],
        },
        response_metadata: {
          finish_reason: 'tool_calls',
          model_name: 'nvidia/nemotron-3-nano-30b-a3b:free',
        },
      });

    // 3 chunks vazios (no incidente foram 746) + o final repetido pelo gateway.
    const events = await collect(
      streamLangChainEvents(
        streamOf([
          new AIMessageChunk({ content: '' }),
          new AIMessageChunk({ content: '' }),
          new AIMessageChunk({ content: '' }),
          finalChunk(),
          finalChunk(),
        ]),
      ),
    );

    // A tool call precisa sair UMA vez, com os argumentos íntegros — o merge
    // duplica a string de `arguments` exatamente como duplica o finish_reason.
    const toolCalls = events.filter((e) => e.type === 'tool_call');
    expect(toolCalls).toEqual([
      {
        type: 'tool_call',
        id: 'call_prod',
        name: 'update_feature_flag',
        input: { key: 'AI_AGENT', enabled: false },
      },
    ]);
    // E o turno não pode ser reportado como truncado: 'tool_callstool_calls'
    // precisa ser lido como 'tool_calls', não cair no ramo de erro.
    expect(events.some((e) => e.type === 'error')).toBe(false);
    expect(events.at(-1)).toMatchObject({ type: 'done' });
  });

  it('maps usage_metadata to the done event', async () => {
    const events = await collect(
      streamLangChainEvents(
        streamOf([
          new AIMessageChunk({
            content: 'hi',
            usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
          }),
        ]),
      ),
    );
    expect(events).toEqual([
      { type: 'text', text: 'hi' },
      { type: 'done', usage: { inputTokens: 10, outputTokens: 5 } },
    ]);
  });
});
