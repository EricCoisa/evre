import { describe, it, expect, vi } from 'vitest';
import { MemorySaver } from '@langchain/langgraph';
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import type { AiService } from '../ai.service';
import type { ToolRegistry, DispatchResult } from '../tool-registry.service';
import type { AiToolContext } from 'src/domain/ai/ai-tool.types';
import type { AiStreamEvent } from 'src/domain/interface/ai-provider.interface';
import {
  ScriptedChatModel,
  turnFromEvents,
} from 'test/helpers/scripted-chat-model';
import {
  runAgentGraph,
  getConversationHistory,
  rewindConversation,
  windowHistory,
} from './agent-graph';

async function collect(gen: AsyncGenerator<AiStreamEvent>): Promise<AiStreamEvent[]> {
  const out: AiStreamEvent[] = [];
  for await (const event of gen) out.push(event);
  return out;
}

/** Testa o grafo com um dublê real de `BaseChatModel`, alimentado por roteiros em `AiStreamEvent`. */
function fakeAiService(
  chatImpls: Array<() => AsyncGenerator<AiStreamEvent>>,
): AiService {
  const model = new ScriptedChatModel(chatImpls.map(turnFromEvents));
  return {
    getChatModel: vi.fn().mockResolvedValue(model),
  } as unknown as AiService;
}

function fakeToolRegistry(
  dispatchImpl: (name: string) => DispatchResult,
  approvalScopes: Record<string, string> = {},
): ToolRegistry {
  return {
    getToolDefinitions: vi.fn().mockResolvedValue([]),
    dispatch: vi.fn(async (name: string) => dispatchImpl(name)),
    getApprovalScope: vi.fn((name: string) => approvalScopes[name]),
  } as unknown as ToolRegistry;
}

const ctx: AiToolContext = { userId: 'u1', roleName: 'ADMIN', approvedScopes: [] };

async function* textThenDone(): AsyncGenerator<AiStreamEvent> {
  yield { type: 'text', text: 'Hello' };
  yield { type: 'text', text: ' world' };
  yield { type: 'done', usage: { inputTokens: 5, outputTokens: 2 } };
}

describe('runAgentGraph', () => {
  it('streams text as it arrives and yields a single done when the model makes no tool calls', async () => {
    const aiService = fakeAiService([textThenDone]);
    const toolRegistry = fakeToolRegistry(() => ({ status: 'ok', result: {} }));

    const events = await collect(
      runAgentGraph({
        messages: [{ role: 'user', content: 'hi' }],
        ctx,
        maxIterations: 10,
        aiService,
        toolRegistry,
      }),
    );

    expect(events).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' world' },
      { type: 'done', usage: { inputTokens: 5, outputTokens: 2 } },
    ]);
    expect(toolRegistry.dispatch).not.toHaveBeenCalled();
  });

  it('runs a read tool call and loops back to the model for the final answer — same sequence runToolLoop produced', async () => {
    async function* callTool(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'tool_call', id: 'tc1', name: 'list_users', input: { page: 1 } };
      yield { type: 'done', usage: undefined };
    }
    async function* finalAnswer(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'text', text: 'There are 3 users.' };
      yield { type: 'done', usage: { inputTokens: 20, outputTokens: 6 } };
    }
    const aiService = fakeAiService([callTool, finalAnswer]);
    const toolRegistry = fakeToolRegistry(() => ({
      status: 'ok',
      result: { count: 3 },
      invalidates: ['user'],
    }));

    const events = await collect(
      runAgentGraph({
        messages: [{ role: 'user', content: 'how many users?' }],
        ctx,
        maxIterations: 10,
        aiService,
        toolRegistry,
      }),
    );

    expect(events).toEqual([
      { type: 'tool_call', id: 'tc1', name: 'list_users', input: { page: 1 } },
      { type: 'tool_result', toolCallId: 'tc1', result: { count: 3 }, invalidates: ['user'] },
      { type: 'text', text: 'There are 3 users.' },
      { type: 'done', usage: { inputTokens: 20, outputTokens: 6 } },
    ]);
    expect(toolRegistry.dispatch).toHaveBeenCalledWith('list_users', { page: 1 }, ctx);
  });

  it('pauses via interrupt() when a write tool is not approved, without running the tool — and resumes cleanly after a decision', async () => {
    const checkpointer = new MemorySaver();
    const threadId = 'thread-approval-1';

    async function* callWriteTool(): AsyncGenerator<AiStreamEvent> {
      yield {
        type: 'tool_call',
        id: 'tc1',
        name: 'toggle_feature_flag',
        input: { id: 'f1', enabled: true },
      };
      yield { type: 'done', usage: undefined };
    }
    async function* finalAnswer(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'text', text: 'Feito.' };
      yield { type: 'done', usage: undefined };
    }
    const aiService = fakeAiService([callWriteTool, finalAnswer]);
    const toolRegistry = fakeToolRegistry(() => ({ status: 'ok', result: { toggled: true } }), {
      toggle_feature_flag: 'feature-flags:write',
    });

    // Turno 1 — modelo pede a tool, node de tools pausa no interrupt() ANTES
    // de despachar (dispatch nunca chamado nesta passada).
    const events1 = await collect(
      runAgentGraph({
        messages: [{ role: 'user', content: 'ative a flag f1' }],
        ctx,
        maxIterations: 10,
        aiService,
        toolRegistry,
        checkpointer,
        threadId,
      }),
    );
    expect(events1).toEqual([
      { type: 'tool_call', id: 'tc1', name: 'toggle_feature_flag', input: { id: 'f1', enabled: true } },
      {
        type: 'approval_required',
        toolCallId: 'tc1',
        tool: 'toggle_feature_flag',
        scope: 'feature-flags:write',
        input: { id: 'f1', enabled: true },
      },
      { type: 'done' },
    ]);
    expect(toolRegistry.dispatch).not.toHaveBeenCalled();

    // Turno 2 — retoma com Command({resume: 'once'}), mesma thread. O node
    // reexecuta do topo: o interrupt() já resolvido retorna na hora (não
    // pausa de novo), SÓ ENTÃO despacha — uma única vez.
    const events2 = await collect(
      runAgentGraph({
        messages: [],
        ctx,
        maxIterations: 10,
        aiService,
        toolRegistry,
        checkpointer,
        threadId,
        resume: 'once',
      }),
    );
    expect(events2).toEqual([
      { type: 'tool_result', toolCallId: 'tc1', result: { toggled: true }, invalidates: undefined },
      { type: 'text', text: 'Feito.' },
      { type: 'done', usage: undefined },
    ]);
    expect(toolRegistry.dispatch).toHaveBeenCalledTimes(1);
    expect(toolRegistry.dispatch).toHaveBeenCalledWith(
      'toggle_feature_flag',
      { id: 'f1', enabled: true },
      expect.objectContaining({ approvedScopes: ['feature-flags:write'] }),
    );
  });

  it('denies a tool call via resume — no dispatch, model sees a denial and continues', async () => {
    const checkpointer = new MemorySaver();
    const threadId = 'thread-deny-1';

    async function* callWriteTool(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'tool_call', id: 'tc1', name: 'remove_route', input: { id: 'r1' } };
      yield { type: 'done', usage: undefined };
    }
    async function* acknowledge(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'text', text: 'Ok, não removi.' };
      yield { type: 'done', usage: undefined };
    }
    const aiService = fakeAiService([callWriteTool, acknowledge]);
    const toolRegistry = fakeToolRegistry(() => ({ status: 'ok', result: {} }), {
      remove_route: 'routes:write',
    });

    await collect(
      runAgentGraph({
        messages: [{ role: 'user', content: 'remove a rota r1' }],
        ctx,
        maxIterations: 10,
        aiService,
        toolRegistry,
        checkpointer,
        threadId,
      }),
    );

    const events = await collect(
      runAgentGraph({
        messages: [],
        ctx,
        maxIterations: 10,
        aiService,
        toolRegistry,
        checkpointer,
        threadId,
        resume: 'deny',
      }),
    );

    expect(events).toEqual([
      { type: 'tool_result', toolCallId: 'tc1', result: { denied: 'Ação negada pelo usuário' }, invalidates: undefined },
      { type: 'text', text: 'Ok, não removi.' },
      { type: 'done', usage: undefined },
    ]);
    expect(toolRegistry.dispatch).not.toHaveBeenCalled();
  });

  // Simetria com o "conversation" decision abaixo: uma vez concedido, um
  // scope cobre TODAS as calls restantes da leva sem perguntar de novo — negar
  // tem que se comportar igual, senão a segunda call do mesmo scope repete a
  // pergunta que o usuário acabou de responder "não".
  it('denying a scope once denies every other call for that scope in the same batch, without asking again', async () => {
    const checkpointer = new MemorySaver();
    const threadId = 'thread-deny-batch-1';

    async function* callTwoWriteTools(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'tool_call', id: 'tc1', name: 'remove_route', input: { id: 'r1' } };
      yield { type: 'tool_call', id: 'tc2', name: 'remove_route', input: { id: 'r2' } };
      yield { type: 'done', usage: undefined };
    }
    async function* acknowledge(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'text', text: 'Ok, não removi nenhuma.' };
      yield { type: 'done', usage: undefined };
    }
    const aiService = fakeAiService([callTwoWriteTools, acknowledge]);
    const toolRegistry = fakeToolRegistry(() => ({ status: 'ok', result: {} }), {
      remove_route: 'routes:write',
    });

    const events1 = await collect(
      runAgentGraph({
        messages: [{ role: 'user', content: 'remove as rotas r1 e r2' }],
        ctx,
        maxIterations: 10,
        aiService,
        toolRegistry,
        checkpointer,
        threadId,
      }),
    );
    // Só UM approval_required — a segunda call do mesmo scope ainda não foi
    // perguntada (a leva pausa uma pendência por vez).
    expect(events1.filter((e) => e.type === 'approval_required')).toHaveLength(1);

    const events2 = await collect(
      runAgentGraph({
        messages: [],
        ctx,
        maxIterations: 10,
        aiService,
        toolRegistry,
        checkpointer,
        threadId,
        resume: 'deny',
      }),
    );

    // Nenhum approval_required NOVO pra tc2: o deny de tc1 já cobriu o scope
    // pro resto da leva. As duas calls saem como negadas, nenhuma despachada.
    expect(events2.filter((e) => e.type === 'approval_required')).toHaveLength(0);
    expect(events2).toEqual([
      { type: 'tool_result', toolCallId: 'tc1', result: { denied: 'Ação negada pelo usuário' }, invalidates: undefined },
      { type: 'tool_result', toolCallId: 'tc2', result: { denied: 'Ação negada pelo usuário' }, invalidates: undefined },
      { type: 'text', text: 'Ok, não removi nenhuma.' },
      { type: 'done', usage: undefined },
    ]);
    expect(toolRegistry.dispatch).not.toHaveBeenCalled();
  });

  it('"conversation" decision is remembered across separate runAgentGraph calls on the same thread', async () => {
    const checkpointer = new MemorySaver();
    const threadId = 'thread-conversation-1';

    async function* callWriteTool(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'tool_call', id: 'tc1', name: 'toggle_feature_flag', input: { id: 'f1', enabled: true } };
      yield { type: 'done', usage: undefined };
    }
    async function* finalAnswer1(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'text', text: 'Feito.' };
      yield { type: 'done', usage: undefined };
    }
    async function* callWriteToolAgain(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'tool_call', id: 'tc2', name: 'toggle_feature_flag', input: { id: 'f2', enabled: false } };
      yield { type: 'done', usage: undefined };
    }
    async function* finalAnswer2(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'text', text: 'Feito de novo.' };
      yield { type: 'done', usage: undefined };
    }
    const aiService = fakeAiService([
      callWriteTool,
      finalAnswer1,
      callWriteToolAgain,
      finalAnswer2,
    ]);
    const toolRegistry = fakeToolRegistry(() => ({ status: 'ok', result: {} }), {
      toggle_feature_flag: 'feature-flags:write',
    });

    await collect(
      runAgentGraph({
        messages: [{ role: 'user', content: 'ative a flag f1' }],
        ctx,
        maxIterations: 10,
        aiService,
        toolRegistry,
        checkpointer,
        threadId,
      }),
    );
    await collect(
      runAgentGraph({
        messages: [],
        ctx,
        maxIterations: 10,
        aiService,
        toolRegistry,
        checkpointer,
        threadId,
        resume: 'conversation',
      }),
    );

    // Turno novo, mesma thread, mesma tool — não deveria interromper de novo.
    const events3 = await collect(
      runAgentGraph({
        messages: [{ role: 'user', content: 'desative a flag f2' }],
        ctx, // approvedScopes vazio de propósito — quem lembra é o checkpoint, não o caller
        maxIterations: 10,
        aiService,
        toolRegistry,
        checkpointer,
        threadId,
      }),
    );

    expect(events3.some((e) => e.type === 'approval_required')).toBe(false);
    expect(events3).toEqual([
      { type: 'tool_call', id: 'tc2', name: 'toggle_feature_flag', input: { id: 'f2', enabled: false } },
      { type: 'tool_result', toolCallId: 'tc2', result: {}, invalidates: undefined },
      { type: 'text', text: 'Feito de novo.' },
      { type: 'done', usage: undefined },
    ]);
  });

  it('translates a thrown error (e.g. provider failure) into error + done, matching runToolLoop', async () => {
    async function* boom(): AsyncGenerator<AiStreamEvent> {
      throw new Error('network down');
      // eslint-disable-next-line no-unreachable
      yield { type: 'text', text: 'never' };
    }
    const aiService = fakeAiService([boom]);
    const toolRegistry = fakeToolRegistry(() => ({ status: 'ok', result: {} }));

    const events = await collect(
      runAgentGraph({
        messages: [{ role: 'user', content: 'hi' }],
        ctx,
        maxIterations: 10,
        aiService,
        toolRegistry,
      }),
    );

    expect(events).toEqual([
      { type: 'error', message: 'network down' },
      { type: 'done' },
    ]);
  });
});

describe('getConversationHistory', () => {
  it('keeps the tool call and its result in the persisted history — not just the final answer', async () => {
    async function* callTool(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'tool_call', id: 'tc1', name: 'list_users', input: { page: 1 } };
      yield { type: 'done', usage: undefined };
    }
    async function* finalAnswer(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'text', text: 'There are 3 users.' };
      yield { type: 'done', usage: undefined };
    }
    const aiService = fakeAiService([callTool, finalAnswer]);
    const toolRegistry = fakeToolRegistry(() => ({ status: 'ok', result: { count: 3 } }));
    const checkpointer = new MemorySaver();

    await collect(
      runAgentGraph({
        messages: [{ role: 'user', content: 'how many users?' }],
        ctx,
        maxIterations: 10,
        aiService,
        toolRegistry,
        checkpointer,
        threadId: 'thread-history-tools',
      }),
    );

    const history = await getConversationHistory(checkpointer, 'thread-history-tools');

    expect(history.map((m) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);
    expect(history[1]).toMatchObject({
      role: 'assistant',
      toolCalls: [{ id: 'tc1', name: 'list_users', input: { page: 1 } }],
    });
    expect(history[2]).toMatchObject({ toolCallId: 'tc1', content: '{"count":3}' });
  });
});

// A janela opera direto em BaseMessage[] — é o formato do estado do grafo e o
// que vai para o modelo, sem conversão no meio.
describe('windowHistory', () => {
  const user = (n: number) => new HumanMessage(`u${n}`);
  const assistant = (n: number) => new AIMessage(`a${n}`);

  it('keeps everything while the conversation is shorter than the window', () => {
    const history = [user(1), assistant(1), user(2)];
    expect(windowHistory(history, 30)).toEqual(history);
  });

  it('keeps only the last `size` messages once the conversation grows past it', () => {
    const history = Array.from({ length: 40 }, (_, i) => user(i));
    expect(windowHistory(history, 10)).toEqual(history.slice(30));
  });

  it('never starts the window on an orphan tool message', () => {
    const closing = assistant(2);
    const history = [
      user(1),
      new AIMessage({ content: '', tool_calls: [{ id: 't1', name: 'x', args: {} }] }),
      new ToolMessage({ content: '{}', tool_call_id: 't1' }),
      new ToolMessage({ content: '{}', tool_call_id: 't2' }),
      closing,
    ];

    // size=3 cairia em cima do primeiro `tool` — a janela precisa avançar.
    const windowed = windowHistory(history, 3);

    expect(windowed.some((m) => ToolMessage.isInstance(m))).toBe(false);
    expect(windowed).toEqual([closing]);
  });
});

describe('rewindConversation', () => {
  async function twoTurns(threadId: string, checkpointer: MemorySaver) {
    const aiService = fakeAiService([textThenDone]);
    const toolRegistry = fakeToolRegistry(() => ({ status: 'ok', result: {} }));
    for (const content of ['primeira', 'segunda']) {
      await collect(
        runAgentGraph({
          messages: [{ role: 'user', content }],
          ctx,
          maxIterations: 10,
          aiService,
          toolRegistry,
          checkpointer,
          threadId,
        }),
      );
    }
    return { aiService, toolRegistry };
  }

  it('drops the given message and everything after it, keeping the same thread', async () => {
    const checkpointer = new MemorySaver();
    const threadId = 'thread-rewind';
    const { aiService, toolRegistry } = await twoTurns(threadId, checkpointer);

    const before = await getConversationHistory(checkpointer, threadId);
    expect(before).toHaveLength(4);
    const secondQuestion = before[2];

    const returned = await rewindConversation({
      ctx,
      aiService,
      toolRegistry,
      checkpointer,
      threadId,
      messageId: secondQuestion.id!,
    });

    // O que voltou e o que ficou no checkpoint são a mesma coisa — sem isso o
    // front precisaria de um refetch pra descobrir o estado real.
    const persisted = await getConversationHistory(checkpointer, threadId);
    expect(returned).toEqual(persisted);
    expect(persisted.map((m) => m.content)).toEqual(['primeira', 'Hello world']);
  });

  it('leaves the conversation untouched when the message is not part of it', async () => {
    const checkpointer = new MemorySaver();
    const threadId = 'thread-rewind-unknown';
    const { aiService, toolRegistry } = await twoTurns(threadId, checkpointer);

    const returned = await rewindConversation({
      ctx,
      aiService,
      toolRegistry,
      checkpointer,
      threadId,
      messageId: 'não existe',
    });

    expect(returned).toEqual(await getConversationHistory(checkpointer, threadId));
    expect(returned).toHaveLength(4);
  });

  it('lets the conversation continue from the rewound point', async () => {
    const checkpointer = new MemorySaver();
    const threadId = 'thread-rewind-continue';
    const { toolRegistry } = await twoTurns(threadId, checkpointer);
    const before = await getConversationHistory(checkpointer, threadId);

    const rewindService = fakeAiService([textThenDone]);
    await rewindConversation({
      ctx,
      aiService: rewindService,
      toolRegistry,
      checkpointer,
      threadId,
      messageId: before[2].id!,
    });

    async function* newAnswer(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'text', text: 'Resposta nova' };
      yield { type: 'done', usage: undefined };
    }
    await collect(
      runAgentGraph({
        messages: [{ role: 'user', content: 'segunda (de novo)' }],
        ctx,
        maxIterations: 10,
        aiService: fakeAiService([newAnswer]),
        toolRegistry,
        checkpointer,
        threadId,
      }),
    );

    const after = await getConversationHistory(checkpointer, threadId);
    expect(after.map((m) => m.content)).toEqual([
      'primeira',
      'Hello world',
      'segunda (de novo)',
      'Resposta nova',
    ]);
  });
});

describe('runAgentGraph — `done` só depois do checkpoint gravado', () => {
  it('has the assistant answer already persisted at the moment `done` reaches the client', async () => {
    const aiService = fakeAiService([textThenDone]);
    const toolRegistry = fakeToolRegistry(() => ({ status: 'ok', result: {} }));
    const checkpointer = new MemorySaver();
    const threadId = 'thread-done-after-commit';

    let historyAtDone: Awaited<ReturnType<typeof getConversationHistory>> = [];
    for await (const event of runAgentGraph({
      messages: [{ role: 'user', content: 'oi' }],
      ctx,
      maxIterations: 10,
      aiService,
      toolRegistry,
      checkpointer,
      threadId,
    })) {
      if (event.type === 'done') {
        historyAtDone = await getConversationHistory(checkpointer, threadId);
      }
    }

    expect(historyAtDone.at(-1)).toMatchObject({
      role: 'assistant',
      content: 'Hello world',
    });
  });

  it('still emits exactly one done, carrying the usage the model reported', async () => {
    const aiService = fakeAiService([textThenDone]);
    const toolRegistry = fakeToolRegistry(() => ({ status: 'ok', result: {} }));

    const events = await collect(
      runAgentGraph({
        messages: [{ role: 'user', content: 'oi' }],
        ctx,
        maxIterations: 10,
        aiService,
        toolRegistry,
      }),
    );

    expect(events.filter((e) => e.type === 'done')).toEqual([
      { type: 'done', usage: { inputTokens: 5, outputTokens: 2 } },
    ]);
  });
});

describe('agentNode — resposta vazia do modelo', () => {
  it('does not append an empty assistant message when the model produced no text and no tool call', async () => {
    // Modelo de reasoning que devolve só reasoning (ou nada): sem o guard, o
    // grafo gravava um AIMessage vazio, que virava bolha vazia na UI e turno
    // vazio no contexto das próximas chamadas.
    async function* reasoningOnly(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'reasoning', text: 'pensando...' };
      yield { type: 'done', usage: undefined };
    }
    const aiService = fakeAiService([reasoningOnly]);
    const toolRegistry = fakeToolRegistry(() => ({ status: 'ok', result: {} }));
    const checkpointer = new MemorySaver();

    await collect(
      runAgentGraph({
        messages: [{ role: 'user', content: 'oi' }],
        ctx,
        maxIterations: 10,
        aiService,
        toolRegistry,
        checkpointer,
        threadId: 'thread-empty-answer',
      }),
    );

    const history = await getConversationHistory(checkpointer, 'thread-empty-answer');
    expect(history).toEqual([
      { role: 'user', content: 'oi', id: expect.any(String) },
    ]);
  });
});
