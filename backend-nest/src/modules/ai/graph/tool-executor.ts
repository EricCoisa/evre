import { ToolMessage } from '@langchain/core/messages';
import type { ToolCall } from '@langchain/core/messages';
import type { ToolRegistry } from '../tool-registry.service';
import type { AiToolContext } from 'src/domain/ai/ai-tool.types';

/** Nó de execução de tools do grafo — única porta de entrada pra rodar uma tool, via `ToolRegistry.dispatch()`. */

export interface PendingApproval {
  toolCallId: string;
  tool: string;
  scope: string;
  input: unknown;
}

/** Decisão do usuário sobre uma aprovação pendente — mesmo contrato do `ResolveApprovalDto`. */
export type ApprovalDecision = 'once' | 'conversation' | 'deny';

/** Resultado de UMA tool call já resolvida (ok ou error) — serve tanto pro estado do grafo (message) quanto pro evento SSE (result/invalidates), sem round-trip de JSON.parse. */
export interface ToolCallOutcome {
  toolCallId: string;
  message: ToolMessage;
  result: unknown;
  invalidates?: string[];
}

/** Executa as tool calls de um turno do modelo, em paralelo, devolvendo exatamente um outcome por call. */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  ctx: AiToolContext,
  toolRegistry: ToolRegistry,
): Promise<{ outcomes: ToolCallOutcome[] }> {
  const outcomes = await Promise.all(
    toolCalls.map(async (call) => {
      const result = await toolRegistry.dispatch(call.name, call.args, ctx);
      const value =
        result.status === 'ok'
          ? result.result
          : {
              error:
                // Scope pendente aqui é divergência entre getApprovalScope() e dispatch().
                result.status === 'approval_required'
                  ? `Aprovação pendente não resolvida para o scope ${result.scope}`
                  : result.message,
            };
      return {
        toolCallId: call.id ?? '',
        result: value,
        invalidates: result.status === 'ok' ? result.invalidates : undefined,
        message: new ToolMessage({
          content: JSON.stringify(value),
          tool_call_id: call.id ?? '',
          status: result.status === 'ok' ? 'success' : 'error',
        }),
      };
    }),
  );

  return { outcomes };
}
