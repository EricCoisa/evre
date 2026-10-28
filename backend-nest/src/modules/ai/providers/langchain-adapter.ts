import { Logger } from '@nestjs/common';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import type { AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import type { ToolDefinition } from '@langchain/core/language_models/base';
import type {
  AiChatMessage,
  AiStreamEvent,
  AiWireTool,
} from 'src/domain/interface/ai-provider.interface';

/** Ponte entre o formato interno do módulo `ai/` e o formato normalizado do LangChain. */

const logger = new Logger('LangChainAdapter');

/** AiChatMessage[] (histórico interno) → BaseMessage[] (LangChain). */
export function toLangChainMessages(
  messages: AiChatMessage[],
  system?: string,
): BaseMessage[] {
  const out: BaseMessage[] = [];
  if (system) out.push(new SystemMessage(system));
  for (const msg of messages) {
    if (msg.role === 'user') {
      out.push(new HumanMessage(msg.content));
    } else if (msg.role === 'assistant') {
      out.push(
        new AIMessage({
          content: msg.content,
          tool_calls: msg.toolCalls?.map((tc) => ({
            id: tc.id,
            name: tc.name,
            args: tc.input as Record<string, unknown>,
          })),
        }),
      );
    } else {
      out.push(
        new ToolMessage({ content: msg.content, tool_call_id: msg.toolCallId }),
      );
    }
  }
  return out;
}

/** Converte `BaseMessage[]` (estado do grafo) para `AiChatMessage[]` (formato da API HTTP). */
export function fromLangChainMessages(
  messages: BaseMessage[],
): AiChatMessage[] {
  const out: AiChatMessage[] = [];
  for (const msg of messages) {
    if (HumanMessage.isInstance(msg)) {
      out.push({ role: 'user', content: msg.text, id: msg.id });
    } else if (AIMessage.isInstance(msg)) {
      out.push({
        role: 'assistant',
        content: msg.text,
        toolCalls: msg.tool_calls?.map((tc) => ({
          id: tc.id ?? '',
          name: tc.name,
          input: tc.args,
        })),
        id: msg.id,
      });
    } else if (ToolMessage.isInstance(msg)) {
      out.push({
        role: 'tool',
        toolCallId: msg.tool_call_id,
        content: msg.text,
        id: msg.id,
      });
    }
  }
  return out;
}

/** AiWireTool[] (JSON Schema já convertido do Zod pelo ToolRegistry) → tool do LangChain. */
export function toLangChainTools(
  tools?: AiWireTool[],
): ToolDefinition[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

/** Forma normalizada de uma tool call, seja ela parseada pelo LangChain ou recuperada crua. */
interface NormalizedToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

/** Traduz o stream de `AIMessageChunk` para `AiStreamEvent`; só emite tool_call já completa. */
export async function* streamLangChainEvents(
  stream: AsyncIterable<AIMessageChunk>,
  /** Refaz a mesma chamada sem streaming; usado só quando o stream não produziu nada aproveitável. */
  retryWithoutStreaming?: () => Promise<AIMessage | AIMessageChunk>,
): AsyncGenerator<AiStreamEvent, AIMessage | undefined> {
  let merged: AIMessageChunk | undefined;
  let chunks = 0;
  let textChars = 0;
  let reasoningChars = 0;

  for await (const chunk of stream) {
    chunks += 1;
    for (const block of chunk.contentBlocks) {
      if (block.type === 'text' && block.text) {
        textChars += block.text.length;
        yield { type: 'text', text: block.text };
      } else if (block.type === 'reasoning' && block.reasoning) {
        reasoningChars += block.reasoning.length;
        yield { type: 'reasoning', text: block.reasoning };
      }
    }

    // Fallback de reasoning em `additional_kwargs`, usado por gateways OpenAI-compatible.
    const rawReasoning = readRawReasoning(chunk);
    if (rawReasoning) {
      reasoningChars += rawReasoning.length;
      yield { type: 'reasoning', text: rawReasoning };
    }

    merged = merged ? merged.concat(chunk) : chunk;
  }

  // `concat()` duplica strings de `response_metadata`; normaliza `finish_reason` por substring.
  const finishReason = normalizeFinishReason(
    merged?.response_metadata?.finish_reason,
  );

  // Recupera a tool call de `additional_kwargs.tool_calls` quando o merge não produziu nenhuma.
  const parsed = merged?.tool_calls ?? [];
  const toolCalls: NormalizedToolCall[] =
    parsed.length === 0 && finishReason === 'tool_calls'
      ? recoverRawToolCalls(merged)
      : parsed;

  for (const tc of toolCalls) {
    yield { type: 'tool_call', id: tc.id ?? '', name: tc.name, input: tc.args };
  }

  // Reporta tool calls inválidas (JSON não parseável) e respostas truncadas por limite de tokens, sem despachar.
  for (const invalid of merged?.invalid_tool_calls ?? []) {
    logger.warn(
      `Tool call inválida descartada pelo parser: ${invalid.name ?? '(sem nome)'} — args: ${invalid.args ?? ''}`,
    );
    yield {
      type: 'error',
      message: `O modelo tentou usar a ferramenta "${invalid.name ?? 'desconhecida'}" com argumentos inválidos e a chamada foi descartada. Peça de novo, de preferência sendo mais específico.`,
    };
  }

  if (finishReason === 'length') {
    logger.warn(
      `Resposta truncada por limite de tokens (finish_reason=length) — tool calls completas: ${toolCalls.length}`,
    );
    yield {
      type: 'error',
      message:
        'A resposta do modelo foi cortada por limite de tokens antes de terminar. Se o modelo usa reasoning, o limite pode estar sendo consumido pelo raciocínio.',
    };
  }

  const usage = merged?.usage_metadata;
  // Monta a AIMessage final que o node anexa ao estado do grafo, com content como texto puro.
  let finalMessage: AIMessage | undefined = merged
    ? new AIMessage({
        id: merged.id,
        content: merged.text,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id ?? '',
          name: tc.name,
          args: tc.args,
        })),
        additional_kwargs: merged.additional_kwargs,
        response_metadata: merged.response_metadata,
        usage_metadata: merged.usage_metadata,
      })
    : undefined;

  const summary =
    `resposta ← chunks=${chunks} texto=${textChars}ch reasoning=${reasoningChars}ch ` +
    `tool_calls=${toolCalls.length} finish_reason=${finishReason ?? '(não reportado)'} ` +
    `tokens=${usage ? `${usage.input_tokens}/${usage.output_tokens}` : '(não reportados)'}`;

  if (!textChars && !reasoningChars && toolCalls.length === 0) {
    // Dump cru da resposta vazia: separa "o modelo não respondeu" de "respondeu em formato ilegível".
    logger.warn(
      `${summary} — resposta VAZIA. response_metadata: ${JSON.stringify(merged?.response_metadata ?? {})} ` +
        `additional_kwargs: ${JSON.stringify(merged?.additional_kwargs ?? {})}`,
    );

    // Último recurso: refaz a chamada sem streaming para recuperar o turno.
    if (retryWithoutStreaming) {
      logger.warn('Refazendo a chamada sem streaming para recuperar o turno.');
      try {
        const message = await retryWithoutStreaming();
        for (const event of eventsFromMessage(message)) yield event;
        // O turno é o que a chamada não-streaming devolveu — é ela que tem a
        // tool call que o stream perdeu.
        finalMessage = new AIMessage({
          id: message.id,
          content: message.text,
          tool_calls: message.tool_calls ?? [],
          additional_kwargs: message.additional_kwargs,
          response_metadata: message.response_metadata,
          usage_metadata: message.usage_metadata,
        });
      } catch (err) {
        logger.error(
          `Retry sem streaming também falhou: ${String((err as Error)?.message ?? err)}`,
        );
      }
    }
  } else {
    logger.log(summary);
  }

  yield {
    type: 'done',
    usage: usage
      ? { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }
      : undefined,
  };

  return finalMessage;
}

/** Resposta inteira (não-streaming) → os mesmos eventos que o stream produziria, menos o `done`. */
function* eventsFromMessage(
  message: AIMessage | AIMessageChunk,
): Generator<AiStreamEvent> {
  const reasoning = readRawReasoning(message);
  if (reasoning) yield { type: 'reasoning', text: reasoning };
  if (message.text) yield { type: 'text', text: message.text };
  for (const tc of message.tool_calls ?? []) {
    yield { type: 'tool_call', id: tc.id ?? '', name: tc.name, input: tc.args };
  }
  logger.warn(
    `Retry sem streaming recuperou: texto=${message.text?.length ?? 0}ch tool_calls=${message.tool_calls?.length ?? 0}`,
  );
}

/** Ordem importa: 'stop' é substring de nada, mas 'tool_calls'/'length' precisam vir antes de um match genérico. */
const FINISH_REASONS = ['tool_calls', 'length', 'content_filter', 'stop'];

function normalizeFinishReason(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  return FINISH_REASONS.find((known) => raw.includes(known)) ?? raw;
}

/** Campos proprietários de raciocínio usados por gateways OpenAI-compatible (o provider hand-rolled cobria os mesmos). */
const RAW_REASONING_KEYS = [
  'reasoning_content',
  'reasoning',
  'thinking',
  'thinking_content',
];

function readRawReasoning(
  chunk: AIMessage | AIMessageChunk,
): string | undefined {
  const kwargs = chunk.additional_kwargs as Record<string, unknown> | undefined;
  if (!kwargs) return undefined;
  for (const key of RAW_REASONING_KEYS) {
    const value = kwargs[key];
    if (typeof value === 'string' && value) return value;
  }
  return undefined;
}

interface RawToolCall {
  id?: string;
  function?: { name?: string; arguments?: string };
}

/** Recupera tool calls da forma crua do SDK quando o merge do LangChain não parseou nenhuma. */
function recoverRawToolCalls(
  merged: AIMessageChunk | undefined,
): NormalizedToolCall[] {
  const raw = merged?.additional_kwargs?.tool_calls as
    RawToolCall[] | undefined;
  if (!raw?.length) return [];

  const recovered: NormalizedToolCall[] = [];

  for (const call of raw) {
    const name = call.function?.name;
    if (!name) continue;
    const args = parsePossiblyDoubledJson(call.function?.arguments ?? '{}');
    if (!args) {
      logger.warn(
        `Tool call irrecuperável em additional_kwargs: ${name} — args: ${call.function?.arguments ?? ''}`,
      );
      continue;
    }
    logger.warn(
      `Tool call recuperada de additional_kwargs (o merge do LangChain não produziu nenhuma): ${name}`,
    );
    recovered.push({ id: call.id, name, args });
  }

  return recovered;
}

/** Faz parse de JSON que o `concat()` do LangChain pode ter duplicado exatamente. */
function parsePossiblyDoubledJson(
  raw: string,
): Record<string, unknown> | undefined {
  const attempt = (text: string): Record<string, unknown> | undefined => {
    try {
      const parsed: unknown = JSON.parse(text);
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  };

  const direct = attempt(raw);
  if (direct) return direct;

  const half = raw.length / 2;
  if (Number.isInteger(half) && raw.slice(0, half) === raw.slice(half)) {
    return attempt(raw.slice(0, half));
  }
  return undefined;
}
