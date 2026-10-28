import type { ProviderResult } from 'src/domain/interface/provider-result';

export type AiChatMessage =
  | { role: 'user'; content: string; id?: string }
  | {
      role: 'assistant';
      content: string;
      toolCalls?: AiToolCall[];
      id?: string;
    }
  | { role: 'tool'; toolCallId: string; content: string; id?: string };

export type AiToolCall = { id: string; name: string; input: unknown };

export type AiWireTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type AiStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown }
  | {
      type: 'tool_result';
      toolCallId: string;
      result: unknown;
      invalidates?: string[];
    }
  | {
      type: 'approval_required';
      toolCallId: string;
      tool: string;
      scope: string;
      input: unknown;
    }
  | { type: 'error'; message: string }
  | { type: 'done'; usage?: { inputTokens: number; outputTokens: number } };

/** Valida credencial e lista modelos; o chat roda pelo `BaseChatModel` de `AiService.getChatModel()`. */
export interface IAiProvider {
  validateConfiguration(): Promise<ProviderResult>;
  listModels(): Promise<string[]>;
}

export interface IAiService<IConfig> {
  use(config: IConfig): IAiProvider;
}
