import { Logger } from '@nestjs/common';
import {
  Annotation,
  StateGraph,
  START,
  END,
  addMessages,
  getWriter,
  interrupt,
  Command,
} from '@langchain/langgraph';
import type {
  BaseCheckpointSaver,
  LangGraphRunnableConfig,
} from '@langchain/langgraph';
import {
  AIMessage,
  RemoveMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { AiService } from '../ai.service';
import type { ToolRegistry } from '../tool-registry.service';
import type { AiToolContext } from 'src/domain/ai/ai-tool.types';
import type {
  AiChatMessage,
  AiStreamEvent,
} from 'src/domain/interface/ai-provider.interface';
import {
  toLangChainMessages,
  fromLangChainMessages,
  toLangChainTools,
  streamLangChainEvents,
} from '../providers/langchain-adapter';
import { executeToolCalls } from './tool-executor';
import type {
  ApprovalDecision,
  PendingApproval,
  ToolCallOutcome,
} from './tool-executor';

/** Estado do grafo do agente, persistido pelo checkpointer a cada step. */
export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: addMessages,
    default: () => [],
  }),
  // União: scope aprovado numa chamada nunca some numa próxima.
  approvedScopes: Annotation<string[]>({
    reducer: (prev, next) => Array.from(new Set([...prev, ...next])),
    default: () => [],
  }),
});

type AgentStateType = typeof AgentState.State;
type AgentStateUpdate = typeof AgentState.Update;

const logger = new Logger('AgentGraph');

/** Nº de mensagens do histórico que vão pro modelo a cada chamada. */
export const HISTORY_WINDOW = 30;

/** Últimas `size` mensagens do histórico, sem cortar no meio de uma sequência de tool call. */
export function windowHistory(
  messages: BaseMessage[],
  size = HISTORY_WINDOW,
): BaseMessage[] {
  if (messages.length <= size) return messages;
  let start = messages.length - size;
  while (start < messages.length && ToolMessage.isInstance(messages[start]))
    start += 1;
  return messages.slice(start);
}

/** Tudo que `buildAgentGraph` (a forma do grafo) precisa. */
export interface AgentGraphBuildParams {
  ctx: AiToolContext;
  system?: string;
  model?: string;
  abortSignal?: AbortSignal;
  aiService: AiService;
  toolRegistry: ToolRegistry;
  /** Presente = persiste incrementalmente e permite retomar por thread_id. Ausente = roda só em memória (só nos testes). Obrigatório se algum turno puder pedir aprovação — interrupt() não tem onde persistir a pausa sem isso. */
  checkpointer?: BaseCheckpointSaver;
}

/** O que `runAgentGraph` precisa a mais pra efetivamente rodar um turno. */
export interface AgentGraphParams extends AgentGraphBuildParams {
  /** Histórico completo sem checkpointer; só a mensagem nova quando checkpointer+threadId estão presentes. */
  messages: AiChatMessage[];
  /** Nº de idas ao modelo permitidas neste turno — equivalente ao MAX_TOOL_ITERATIONS de hoje. */
  maxIterations: number;
  /** Obrigatório junto de `checkpointer` — identifica a conversa (= AiConversation.id). */
  threadId?: string;
  /** Retoma o `interrupt()` pendente da thread; quando presente, `messages` é ignorado. */
  resume?: ApprovalDecision;
}

export function buildAgentGraph(params: AgentGraphBuildParams) {
  async function agentNode(
    state: AgentStateType,
    config: LangGraphRunnableConfig,
  ): Promise<AgentStateUpdate> {
    const write = getWriter(config);
    const tools = await params.toolRegistry.getToolDefinitions(params.ctx);
    const history = windowHistory(state.messages);

    // Monta o prompt de saída: SystemMessage (se houver) + histórico já em BaseMessage[].
    const outgoing = params.system
      ? [new SystemMessage(params.system), ...history]
      : history;

    // Loga o tamanho do prompt que sai: é ele que cresce até o gateway devolver resposta vazia.
    const promptChars = outgoing.reduce((sum, m) => sum + m.text.length, 0);
    const toolChars = JSON.stringify(tools).length;
    logger.log(
      `chat → mensagens=${history.length}/${state.messages.length} tools=${tools.length} ` +
        `chars(prompt)=${promptChars} chars(tools)=${toolChars} model=${params.model || '(config)'}`,
    );

    const chatModel = await params.aiService.getChatModel(
      params.ctx.userId,
      params.model,
    );
    const langChainTools = toLangChainTools(tools);
    const bound = langChainTools
      ? chatModel.bindTools!(langChainTools)
      : chatModel;
    const options = { signal: params.abortSignal };

    const events = streamLangChainEvents(
      await bound.stream(outgoing, options),
      // Só dispara quando o turno seria perda total (ver langchain-adapter).
      () => bound.invoke(outgoing, options),
    );

    // Repassa os eventos ao vivo e fica com a mensagem final do LangChain, com metadata intacta.
    let step = await events.next();
    while (!step.done) {
      // 'done' é engolido: quem fecha o turno é runAgentGraph, depois do
      // checkpoint gravar. Os demais vão direto pro stream SSE.
      if (step.value.type !== 'done') write?.(step.value);
      step = await events.next();
    }
    const message = step.value;

    const toolCalls = message?.tool_calls ?? [];
    const usage = message?.usage_metadata
      ? {
          inputTokens: message.usage_metadata.input_tokens,
          outputTokens: message.usage_metadata.output_tokens,
        }
      : undefined;

    // Sem tool_call pendente o turno acaba; este `done` carrega o `usage` e é segurado por runAgentGraph.
    if (toolCalls.length === 0) {
      write?.({ type: 'done', usage });
    }

    // Resposta sem texto e sem tool call não vira mensagem: encerra o turno emitindo erro.
    if (!message?.text && toolCalls.length === 0) {
      logger.warn(
        `Resposta vazia do modelo — mensagens=${history.length} tools=${tools.length} ` +
          `chars(prompt)=${promptChars} chars(tools)=${toolChars} ` +
          `usage=${usage ? `${usage.inputTokens}/${usage.outputTokens}` : 'não reportado'}`,
      );
      write?.({
        type: 'error',
        message:
          'O modelo não retornou nenhuma resposta para esta mensagem' +
          (usage
            ? ` (tokens: ${usage.inputTokens} de entrada, ${usage.outputTokens} de saída).`
            : ' e não reportou uso de tokens — normalmente é o prompt excedendo o limite de contexto do modelo.'),
      });
      return {};
    }

    return { messages: [message!] };
  }

  async function toolsNode(
    state: AgentStateType,
    config: LangGraphRunnableConfig,
  ): Promise<AgentStateUpdate> {
    const write = getWriter(config);
    const last = state.messages.at(-1);
    const calls =
      (last && AIMessage.isInstance(last) ? last.tool_calls : undefined) ?? [];

    // Fase 1 — resolve todas as aprovações pendentes antes de despachar qualquer tool call.
    const deniedIds = new Set<string>();
    const deniedScopes = new Set<string>();
    const grantedScopes = new Set(state.approvedScopes);
    const newlyGrantedForConversation: string[] = [];

    for (const call of calls) {
      const scope = params.toolRegistry.getApprovalScope(call.name);
      if (!scope || grantedScopes.has(scope)) continue;

      // Scope já negado nesta leva: nega direto, sem repetir a pergunta.
      if (deniedScopes.has(scope)) {
        deniedIds.add(call.id ?? '');
        continue;
      }

      const decision = interrupt<PendingApproval, ApprovalDecision>({
        toolCallId: call.id ?? '',
        tool: call.name,
        scope,
        input: call.args,
      });

      if (decision === 'deny') {
        deniedIds.add(call.id ?? '');
        deniedScopes.add(scope);
      } else {
        grantedScopes.add(scope);
        if (decision === 'conversation')
          newlyGrantedForConversation.push(scope);
      }
    }

    // Fase 2 — despacha de verdade. Só chega aqui depois que TODAS as
    // aprovações necessárias desta leva já foram resolvidas.
    const effectiveCtx = { ...params.ctx, approvedScopes: [...grantedScopes] };
    const toExecute = calls.filter((c) => !deniedIds.has(c.id ?? ''));
    const { outcomes } = await executeToolCalls(
      toExecute,
      effectiveCtx,
      params.toolRegistry,
    );

    const byId = new Map(outcomes.map((o) => [o.toolCallId, o]));
    for (const call of calls) {
      if (deniedIds.has(call.id ?? '')) {
        byId.set(call.id ?? '', deniedOutcome(call.id ?? ''));
      }
    }
    // Preserva a ordem original das tool calls do turno (não a ordem de
    // conclusão do Promise.all dentro de executeToolCalls).
    const orderedOutcomes = calls
      .map((c) => byId.get(c.id ?? ''))
      .filter((o): o is ToolCallOutcome => o !== undefined);

    for (const outcome of orderedOutcomes) {
      write?.({
        type: 'tool_result',
        toolCallId: outcome.toolCallId,
        result: outcome.result,
        invalidates: outcome.invalidates,
      });
    }

    return {
      messages: orderedOutcomes.map((o) => o.message),
      approvedScopes: newlyGrantedForConversation,
    };
  }

  function routeAfterAgent(state: AgentStateType): 'tools' | typeof END {
    const last = state.messages.at(-1);
    const hasToolCalls =
      !!last &&
      AIMessage.isInstance(last) &&
      (last.tool_calls?.length ?? 0) > 0;
    return hasToolCalls ? 'tools' : END;
  }

  return new StateGraph(AgentState)
    .addNode('agent', agentNode)
    .addNode('tools', toolsNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', routeAfterAgent, ['tools', END])
    .addEdge('tools', 'agent')
    .compile({ checkpointer: params.checkpointer });
}

function deniedOutcome(toolCallId: string): ToolCallOutcome {
  const result = { denied: 'Ação negada pelo usuário' };
  return {
    toolCallId,
    result,
    message: new ToolMessage({
      content: JSON.stringify(result),
      tool_call_id: toolCallId,
      status: 'error',
    }),
  };
}

/** Roda o grafo pra um turno de conversa, devolvendo `AsyncGenerator<AiStreamEvent>`. */
export async function* runAgentGraph(
  params: AgentGraphParams,
): AsyncGenerator<AiStreamEvent> {
  const graph = buildAgentGraph(params);
  try {
    const input =
      params.resume !== undefined
        ? new Command<ApprovalDecision, AgentStateUpdate, 'agent' | 'tools'>({
            resume: params.resume,
          })
        : {
            messages: toLangChainMessages(params.messages),
            approvedScopes: params.ctx.approvedScopes,
          };

    const streamConfig = {
      streamMode: 'custom' as const,
      // recursionLimit conta nodes (agent + tools), não turnos — 2x de folga.
      recursionLimit: params.maxIterations * 2,
      signal: params.abortSignal,
      configurable: params.threadId
        ? { thread_id: params.threadId }
        : undefined,
      // durability 'sync': grava o checkpoint do step N antes do step N+1 começar.
      durability: 'sync' as const,
    };

    const stream = await graph.stream(input, streamConfig);

    // Segura o `done` do agentNode e reemite depois do stream drenar, com o checkpoint gravado.
    let finalDone: AiStreamEvent | undefined;
    for await (const event of stream) {
      const streamEvent = event as AiStreamEvent;
      if (streamEvent.type === 'done') {
        finalDone = streamEvent;
        continue;
      }
      yield streamEvent;
    }

    // Turno pausado num interrupt() não passa pelo stream; confere via getState() depois do drain.
    if (params.checkpointer && params.threadId) {
      const snapshot = await graph.getState({
        configurable: { thread_id: params.threadId },
      });
      const pending = snapshot.tasks.flatMap((t) => t.interrupts)[0];
      if (pending) {
        yield {
          type: 'approval_required',
          ...(pending.value as PendingApproval),
        };
        yield { type: 'done' };
        return;
      }
    }

    yield finalDone ?? { type: 'done' };
  } catch (err) {
    yield { type: 'error', message: String((err as Error)?.message ?? err) };
    yield { type: 'done' };
  }
}

/** Lê o interrupt pendente de uma thread, se houver, sem rodar nenhum node do grafo. */
export async function getPendingApproval(
  params: AgentGraphBuildParams & { threadId: string },
): Promise<PendingApproval | undefined> {
  const graph = buildAgentGraph(params);
  const snapshot = await graph.getState({
    configurable: { thread_id: params.threadId },
  });
  return snapshot.tasks.flatMap((t) => t.interrupts)[0]?.value as
    PendingApproval | undefined;
}

/** Volta a conversa a um ponto anterior, descartando `messageId` e tudo que veio depois, na mesma thread. */
export async function rewindConversation(
  params: AgentGraphBuildParams & { threadId: string; messageId: string },
): Promise<AiChatMessage[]> {
  const graph = buildAgentGraph(params);
  const config = { configurable: { thread_id: params.threadId } };

  const state = await graph.getState(config);
  const messages = (state.values as AgentStateType).messages ?? [];
  const index = messages.findIndex((m) => m.id === params.messageId);
  if (index === -1) return fromLangChainMessages(messages);

  await graph.updateState(config, {
    messages: messages
      .slice(index)
      .map((m) => new RemoveMessage({ id: m.id ?? '' })),
  });

  return fromLangChainMessages(messages.slice(0, index));
}

/** Lê o histórico de uma conversa direto do checkpoint, sem rodar node nenhum. */
export async function getConversationHistory(
  checkpointer: BaseCheckpointSaver,
  threadId: string,
): Promise<AiChatMessage[]> {
  const tuple = await checkpointer.getTuple({
    configurable: { thread_id: threadId },
  });
  const messages = tuple?.checkpoint.channel_values?.messages as
    BaseMessage[] | undefined;
  return fromLangChainMessages(messages ?? []);
}
