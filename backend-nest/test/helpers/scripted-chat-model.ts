import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessageChunk } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { ChatGenerationChunk } from '@langchain/core/outputs';
import type { ChatResult } from '@langchain/core/outputs';
import type { AiStreamEvent } from 'src/domain/interface/ai-provider.interface';

/** Uma ida ao modelo: os chunks que ela emite, ou o erro que ela lança. */
export type ScriptedTurn =
  | { stream: () => AsyncGenerator<AIMessageChunk> }
  | { throws: Error };

/** Modelo de chat scriptado para testes, subclasse real de `BaseChatModel`, com uma resposta por ida ao modelo. */
export class ScriptedChatModel extends BaseChatModel {
  lastMessages: BaseMessage[] = [];
  boundTools: unknown[] | undefined;
  callCount = 0;

  constructor(private readonly turns: ScriptedTurn[]) {
    super({});
  }

  _llmType(): string {
    return 'scripted';
  }

  /** Exigido pela classe base; o grafo sempre streama. */
  _generate(): Promise<ChatResult> {
    return Promise.resolve({ generations: [] });
  }

  override bindTools(tools: unknown[]) {
    this.boundTools = tools;
    return this.withConfig({ tools } as never) as unknown as this;
  }

  override async *_streamResponseChunks(messages: BaseMessage[]) {
    this.lastMessages = messages;
    const turn = this.turns[Math.min(this.callCount, this.turns.length - 1)];
    this.callCount += 1;

    if ('throws' in turn) throw turn.throws;

    for await (const chunk of turn.stream()) {
      // Precisa ser um ChatGenerationChunk DE VERDADE: a classe base sintetiza
      // os eventos de content block a partir dele. Com um objeto plano
      // `{ message, text }` o stream "funciona", mas conteúdo e usage_metadata
      // não chegam do outro lado — e o sintoma é um turno vazio, difícil de
      // ligar à causa.
      yield new ChatGenerationChunk({ message: chunk, text: chunk.text });
    }
  }
}

/** Traduz um roteiro escrito em `AiStreamEvent` para chunks do LangChain. */
export function turnFromEvents(
  impl: () => AsyncGenerator<AiStreamEvent>,
): ScriptedTurn {
  return {
    stream: async function* () {
      for await (const event of impl()) {
        if (event.type === 'text') {
          yield new AIMessageChunk({ content: event.text });
        } else if (event.type === 'reasoning') {
          // Gateways OpenAI-compatible entregam raciocínio aqui, fora do content.
          yield new AIMessageChunk({
            content: '',
            additional_kwargs: { reasoning: event.text },
          });
        } else if (event.type === 'tool_call') {
          yield new AIMessageChunk({
            content: '',
            tool_calls: [
              {
                id: event.id,
                name: event.name,
                args: event.input as Record<string, unknown>,
              },
            ],
          });
        } else if (event.type === 'done' && event.usage) {
          yield new AIMessageChunk({
            content: '',
            usage_metadata: {
              input_tokens: event.usage.inputTokens,
              output_tokens: event.usage.outputTokens,
              total_tokens: event.usage.inputTokens + event.usage.outputTokens,
            },
          });
        }
      }
    },
  };
}
