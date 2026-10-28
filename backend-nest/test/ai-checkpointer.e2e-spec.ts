import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { AiService } from 'src/modules/ai/ai.service';
import type { ToolRegistry, DispatchResult } from 'src/modules/ai/tool-registry.service';
import type { AiToolContext } from 'src/domain/ai/ai-tool.types';
import type { AiStreamEvent } from 'src/domain/interface/ai-provider.interface';
import type { RedisService } from 'src/common/infrastructure/redis/redis.service';
import type { LoggingService } from 'src/modules/logging/logging.service';
import { runAgentGraph, getConversationHistory } from 'src/modules/ai/graph/agent-graph';
import {
  runConversationTurn,
  type ConversationLockPool,
} from 'src/modules/ai/use-cases/run-conversation-turn';
import { ScriptedChatModel, turnFromEvents } from './helpers/scripted-chat-model';

/** Prova o checkpointer com Postgres real (Testcontainers), sem LLM real. */
describe('checkpointer Postgres — persistência entre chamadas', () => {
  let saver: PostgresSaver;

  beforeAll(async () => {
    saver = PostgresSaver.fromConnString(process.env.DATABASE_URL!, {
      schema: 'langgraph',
    });
    await saver.setup();
  });

  afterAll(async () => {
    await saver.end();
  });

  // O grafo consome um BaseChatModel do LangChain direto; os roteiros seguem
  // escritos em AiStreamEvent e `turnFromEvents` traduz (ver o helper).
  function fakeAiService(chatImpls: Array<() => AsyncGenerator<AiStreamEvent>>): AiService {
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

  it('mantém a ordem correta de mensagens entre dois turnos separados na mesma thread (achado #1)', async () => {
    const threadId = randomUUID();
    const toolRegistry = fakeToolRegistry((name) =>
      name === 'list_users'
        ? { status: 'ok', result: { count: 2 } }
        : { status: 'ok', result: { count: 5 } },
    );

    // Turno 1 — 1ª requisição HTTP completa: tool call + resposta final. Cada
    // `runAgentGraph` já faz o loop agent→tools→agent sozinho até não ter mais
    // tool_call (por isso o mock precisa das DUAS respostas pra fechar o turno).
    async function* callUsersTool(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'tool_call', id: 'tc1', name: 'list_users', input: {} };
      yield { type: 'done', usage: undefined };
    }
    async function* finalAnswer1(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'text', text: 'Existem 2 usuários.' };
      yield { type: 'done', usage: undefined };
    }
    const events1: AiStreamEvent[] = [];
    for await (const event of runAgentGraph({
      messages: [{ role: 'user', content: 'quantos usuários existem?' }],
      ctx,
      maxIterations: 10,
      aiService: fakeAiService([callUsersTool, finalAnswer1]),
      toolRegistry,
      checkpointer: saver,
      threadId,
    })) {
      events1.push(event);
    }
    expect(events1).toEqual([
      { type: 'tool_call', id: 'tc1', name: 'list_users', input: {} },
      { type: 'tool_result', toolCallId: 'tc1', result: { count: 2 }, invalidates: undefined },
      { type: 'text', text: 'Existem 2 usuários.' },
      { type: 'done', usage: undefined },
    ]);

    // Turno 2 — SEGUNDA invocação de runAgentGraph (nova requisição HTTP, thread_id
    // igual), com uma mensagem de usuário NOVA — sem reconstruir histórico
    // manualmente, só a mensagem nova. Se a ordem gravada no checkpoint estivesse
    // errada (achado #1), o agent node desse turno veria o histórico embaralhado
    // ao converter de volta pra AiChatMessage[] (fromLangChainMessages).
    async function* callRoutesTool(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'tool_call', id: 'tc2', name: 'list_routes', input: {} };
      yield { type: 'done', usage: undefined };
    }
    async function* finalAnswer2(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'text', text: 'E 5 rotas.' };
      yield { type: 'done', usage: undefined };
    }
    const events2: AiStreamEvent[] = [];
    for await (const event of runAgentGraph({
      messages: [{ role: 'user', content: 'e quantas rotas?' }],
      ctx,
      maxIterations: 10,
      aiService: fakeAiService([callRoutesTool, finalAnswer2]),
      toolRegistry,
      checkpointer: saver,
      threadId,
    })) {
      events2.push(event);
    }
    expect(events2).toEqual([
      { type: 'tool_call', id: 'tc2', name: 'list_routes', input: {} },
      { type: 'tool_result', toolCallId: 'tc2', result: { count: 5 }, invalidates: undefined },
      { type: 'text', text: 'E 5 rotas.' },
      { type: 'done', usage: undefined },
    ]);

    const history = await getConversationHistory(saver, threadId);
    expect(history.map((m) => m.role)).toEqual([
      'user',
      'assistant',
      'tool',
      'assistant',
      'user',
      'assistant',
      'tool',
      'assistant',
    ]);
    // toMatchObject, não toEqual: addMessages (reducer do LangGraph) atribui um
    // id estável por mensagem — fromLangChainMessages propaga isso pro
    // AiChatMessage (LG.8, ver plano — o front usa message.id pra retry).
    expect(history[0]).toMatchObject({ role: 'user', content: 'quantos usuários existem?' });
    expect(history[2]).toMatchObject({ role: 'tool', toolCallId: 'tc1' });
    expect(history[3]).toMatchObject({ role: 'assistant', content: 'Existem 2 usuários.' });
    expect(history[4]).toMatchObject({ role: 'user', content: 'e quantas rotas?' });
    expect(history[6]).toMatchObject({ role: 'tool', toolCallId: 'tc2' });
    expect(history[7]).toMatchObject({ role: 'assistant', content: 'E 5 rotas.' });
  });

  it('interrupt() pausa sem executar a tool e retoma corretamente contra Postgres real (achado #2)', async () => {
    const threadId = randomUUID();
    const toolRegistry = fakeToolRegistry(() => ({ status: 'ok', result: { toggled: true } }), {
      toggle_feature_flag: 'feature-flags:write',
    });

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

    const events1: AiStreamEvent[] = [];
    for await (const event of runAgentGraph({
      messages: [{ role: 'user', content: 'ative a flag f1' }],
      ctx,
      maxIterations: 10,
      aiService: fakeAiService([callWriteTool]),
      toolRegistry,
      checkpointer: saver,
      threadId,
    })) {
      events1.push(event);
    }
    expect(events1.at(-2)).toMatchObject({ type: 'approval_required', toolCallId: 'tc1' });
    expect(toolRegistry.dispatch).not.toHaveBeenCalled();

    // Retoma numa chamada SEPARADA (processo/request diferente na prática) —
    // o checkpoint no Postgres é o que carrega o "estamos pausados aqui".
    const events2: AiStreamEvent[] = [];
    for await (const event of runAgentGraph({
      messages: [],
      ctx,
      maxIterations: 10,
      aiService: fakeAiService([finalAnswer]),
      toolRegistry,
      checkpointer: saver,
      threadId,
      resume: 'once',
    })) {
      events2.push(event);
    }
    expect(events2).toEqual([
      { type: 'tool_result', toolCallId: 'tc1', result: { toggled: true }, invalidates: undefined },
      { type: 'text', text: 'Feito.' },
      { type: 'done', usage: undefined },
    ]);
    expect(toolRegistry.dispatch).toHaveBeenCalledTimes(1);
  });

  it('preserva o progresso já persistido quando o cliente desconecta no meio do turno (achado #3)', async () => {
    const threadId = randomUUID();
    const toolRegistry = fakeToolRegistry(() => ({ status: 'ok', result: { count: 2 } }));

    async function* callUsersTool(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'tool_call', id: 'tc1', name: 'list_users', input: {} };
      yield { type: 'done', usage: undefined };
    }
    // Mesmo caminho de produção: AiController faz `res.on('close', () =>
    // abort.abort())` e passa esse abortSignal até `aiService.chat()`. Aqui a
    // 2ª chamada do modelo (a que geraria a resposta final) simula o cliente
    // já ter ido embora — aborta o controller de verdade e rejeita como um
    // fetch abortado rejeitaria.
    const abort = new AbortController();
    async function* clientDisconnected(): AsyncGenerator<AiStreamEvent> {
      abort.abort();
      throw new Error('The user aborted a request.');
    }

    const events: AiStreamEvent[] = [];
    for await (const event of runAgentGraph({
      messages: [{ role: 'user', content: 'quantos usuários existem?' }],
      ctx,
      maxIterations: 10,
      aiService: fakeAiService([callUsersTool, clientDisconnected]),
      toolRegistry,
      checkpointer: saver,
      threadId,
      abortSignal: abort.signal,
    })) {
      events.push(event);
    }

    // Ninguém está mais ouvindo esses dois eventos finais na prática (o
    // cliente já desconectou) — o que importa é o generator terminar limpo
    // em vez de travar, e o que sobrou gravado no checkpoint.
    expect(events.at(-2)).toMatchObject({ type: 'error' });
    expect(events.at(-1)).toEqual({ type: 'done' });

    // O ponto do achado #3: o tool call e o resultado (nodes que JÁ tinham
    // completado antes do abort) não somem — só a resposta final é que nunca
    // chega, porque essa chamada nunca completou. Isso só é verdade por causa
    // de `durability: 'sync'` em runAgentGraph — com o
    // default da lib (`'async'`), esse teste falhava de verdade: o checkpoint
    // do step anterior ainda podia estar em voo quando o step seguinte
    // falhava rápido, perdendo o tool call inteiro. Empírico, não teórico —
    // reproduzido e confirmado direto contra Postgres antes do fix.
    const history = await getConversationHistory(saver, threadId);
    expect(history.map((m) => m.role)).toEqual(['user', 'assistant', 'tool']);
    expect(history[1]).toMatchObject({
      role: 'assistant',
      toolCalls: [{ id: 'tc1', name: 'list_users' }],
    });
    expect(history[2]).toMatchObject({ role: 'tool', toolCallId: 'tc1' });
  });

  it('deleteThread remove o checkpoint — getTuple não encontra mais nada', async () => {
    const threadId = randomUUID();
    async function* textOnly(): AsyncGenerator<AiStreamEvent> {
      yield { type: 'text', text: 'oi' };
      yield { type: 'done', usage: undefined };
    }
    const toolRegistry = fakeToolRegistry(() => ({ status: 'ok', result: {} }));

    for await (const _ of runAgentGraph({
      messages: [{ role: 'user', content: 'oi' }],
      ctx,
      maxIterations: 10,
      aiService: fakeAiService([textOnly]),
      toolRegistry,
      checkpointer: saver,
      threadId,
    })) {
      // drain
    }

    const before = await saver.getTuple({ configurable: { thread_id: threadId } });
    expect(before).toBeDefined();

    await saver.deleteThread(threadId);

    const after = await saver.getTuple({ configurable: { thread_id: threadId } });
    expect(after).toBeUndefined();
  });

  // Prova, contra Postgres real, que a lib NÃO serializa escritas concorrentes
  // na mesma thread_id por conta própria: `PostgresSaver.getTuple` lê "ORDER BY
  // checkpoint_id DESC LIMIT 1" sem lock e `.put()` só faz UPSERT/COMMIT do
  // checkpoint novo (node_modules/@langchain/langgraph-checkpoint-postgres/dist/index.js:218-230).
  // Chamar `runAgentGraph` direto (sem passar pelo envelope de
  // `runConversationTurn`) reproduz a perda de turno — é exatamente por isso
  // que a exclusão mútua real teve que entrar em `runConversationTurn`
  // (advisory lock do Postgres), não pode depender só do checkpointer.
  it('[gap da lib] dois runAgentGraph concorrentes na mesma thread, sem o envelope de lock, perdem um turno inteiro', async () => {
    const threadId = randomUUID();
    const toolRegistry = fakeToolRegistry(() => ({ status: 'ok', result: {} }));

    // Delay artificial só pra garantir que os dois turnos se sobrepõem de
    // verdade em vez de por sorte de scheduling — sem isso o teste também
    // falha na maioria das vezes, mas fica ocasionalmente flaky.
    function slowTextTurn(text: string) {
      return async function* (): AsyncGenerator<AiStreamEvent> {
        await new Promise((r) => setTimeout(r, 25));
        yield { type: 'text', text };
        yield { type: 'done', usage: undefined };
      };
    }

    async function drain(threadMessage: string, answer: string) {
      const events: AiStreamEvent[] = [];
      for await (const event of runAgentGraph({
        messages: [{ role: 'user', content: threadMessage }],
        ctx,
        maxIterations: 10,
        aiService: fakeAiService([slowTextTurn(answer)]),
        toolRegistry,
        checkpointer: saver,
        threadId,
      })) {
        events.push(event);
      }
      return events;
    }

    // Simula dois envios na mesma conversa sem o lock do Redis no meio (ele
    // roda em run-conversation-turn.ts, uma camada acima de runAgentGraph, e
    // é justamente o que falha aberto quando o Redis está fora do ar).
    await Promise.all([
      drain('pergunta A', 'resposta A'),
      drain('pergunta B', 'resposta B'),
    ]);

    const history = await getConversationHistory(saver, threadId);

    // Se algo serializasse os dois turnos na mesma thread, as duas perguntas e
    // as duas respostas estariam aqui: 4 mensagens. Chamando runAgentGraph
    // direto (sem o advisory lock de runConversationTurn) um turno inteiro
    // (pergunta + resposta) some — sem exceção, sem log, sem qualquer sinal
    // pro caller.
    expect(history).toHaveLength(2);
  });

  // Mesmo cenário do teste acima, mas passando pelo envelope de verdade
  // (runConversationTurn) com um Redis que SEMPRE falha aberto — simula
  // exatamente a situação em que o Redis está fora do ar durante dois envios
  // simultâneos na mesma conversa. O advisory lock do Postgres (independente
  // do Redis) é quem precisa segurar essa corrida agora.
  it('runConversationTurn com Redis falhando aberto NÃO perde turno — advisory lock do Postgres segura a corrida', async () => {
    const threadId = randomUUID();
    const toolRegistry = fakeToolRegistry(() => ({ status: 'ok', result: {} }));

    function slowTextTurn(text: string) {
      return async function* (): AsyncGenerator<AiStreamEvent> {
        await new Promise((r) => setTimeout(r, 25));
        yield { type: 'text', text };
        yield { type: 'done', usage: undefined };
      };
    }

    // Redis que nunca protege de verdade: setnx sempre "adquire" (como o
    // fail-open faz quando o Redis está inacessível), set/del são no-op.
    const alwaysOpenRedis = {
      setnx: () => Promise.resolve(true),
      set: () => Promise.resolve(),
      del: () => Promise.resolve(),
    } as unknown as RedisService;

    const loggingService = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as LoggingService;

    async function drain(threadMessage: string, answer: string) {
      const events: AiStreamEvent[] = [];
      for await (const event of runConversationTurn({
        redis: alwaysOpenRedis,
        // `.pool` é privado no .d.ts da lib (ver checkpointer.service.ts,
        // mesmo bypass) — existe em runtime, é o pg.Pool de verdade.
        pgPool: (saver as unknown as { pool: ConversationLockPool }).pool,
        loggingService,
        logger: new Logger('test'),
        conversationId: threadId,
        userId: 'u1',
        run: () =>
          runAgentGraph({
            messages: [{ role: 'user', content: threadMessage }],
            ctx,
            maxIterations: 10,
            aiService: fakeAiService([slowTextTurn(answer)]),
            toolRegistry,
            checkpointer: saver,
            threadId,
          }),
      })) {
        events.push(event);
      }
      return events;
    }

    await Promise.all([
      drain('pergunta A', 'resposta A'),
      drain('pergunta B', 'resposta B'),
    ]);

    const history = await getConversationHistory(saver, threadId);

    // Com o advisory lock, o segundo turno espera o primeiro soltar em vez de
    // partir do mesmo checkpoint-base — as duas perguntas e as duas respostas
    // sobrevivem, em uma ordem ou outra (a qual dos dois turnos "ganha" a
    // corrida do lock não é determinístico, só que nenhum se perde).
    expect(history).toHaveLength(4);
    expect(history.filter((m) => m.role === 'user')).toHaveLength(2);
    expect(history.filter((m) => m.role === 'assistant')).toHaveLength(2);
  });
});
