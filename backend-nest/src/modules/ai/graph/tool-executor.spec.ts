import { describe, it, expect, vi } from 'vitest';
import type { ToolCall } from '@langchain/core/messages';
import type { ToolRegistry, DispatchResult } from '../tool-registry.service';
import type { AiToolContext } from 'src/domain/ai/ai-tool.types';
import { executeToolCalls } from './tool-executor';

function fakeRegistry(dispatchImpl: (name: string) => DispatchResult) {
  return {
    dispatch: vi.fn(async (name: string) => dispatchImpl(name)),
    getToolDefinitions: vi.fn(),
  } as unknown as ToolRegistry;
}

const ctx: AiToolContext = { userId: 'u1', roleName: 'ADMIN', approvedScopes: [] };

describe('executeToolCalls', () => {
  it('never calls anything but ToolRegistry.dispatch() to run a tool', async () => {
    const registry = fakeRegistry(() => ({ status: 'ok', result: { ok: true } }));
    const calls: ToolCall[] = [{ id: 'tc1', name: 'list_users', args: { page: 1 } }];

    await executeToolCalls(calls, ctx, registry);

    expect(registry.dispatch).toHaveBeenCalledTimes(1);
    expect(registry.dispatch).toHaveBeenCalledWith('list_users', { page: 1 }, ctx);
  });

  it('turns an ok result into a success outcome and keeps its own invalidates', async () => {
    const registry = fakeRegistry(() => ({
      status: 'ok',
      result: { id: '1', name: 'John' },
      invalidates: ['user'],
    }));
    const calls: ToolCall[] = [{ id: 'tc1', name: 'find_user', args: { id: '1' } }];

    const res = await executeToolCalls(calls, ctx, registry);

    expect(res.outcomes).toHaveLength(1);
    const [outcome] = res.outcomes;
    expect(outcome.toolCallId).toBe('tc1');
    expect(outcome.result).toEqual({ id: '1', name: 'John' });
    expect(outcome.invalidates).toEqual(['user']);
    expect(outcome.message.tool_call_id).toBe('tc1');
    expect(outcome.message.status).toBe('success');
    expect(outcome.message.content).toBe(JSON.stringify({ id: '1', name: 'John' }));
  });

  it('turns an error result (role denied, revoked, or invalid input alike) into an error outcome', async () => {
    const registry = fakeRegistry(() => ({
      status: 'error',
      message: 'Permission denied for tool remove_user',
    }));
    const calls: ToolCall[] = [{ id: 'tc1', name: 'remove_user', args: {} }];

    const res = await executeToolCalls(calls, ctx, registry);

    expect(res.outcomes).toHaveLength(1);
    const [outcome] = res.outcomes;
    expect(outcome.result).toEqual({ error: 'Permission denied for tool remove_user' });
    expect(outcome.invalidates).toBeUndefined();
    expect(outcome.message.status).toBe('error');
    expect(outcome.message.content).toBe(
      JSON.stringify({ error: 'Permission denied for tool remove_user' }),
    );
  });

  // Um tool_call sem ToolMessage vira tool_use órfão no histórico, e o provider
  // rejeita a conversa inteira com 400 na ida seguinte ao modelo. approval_required
  // não deveria chegar aqui (o toolsNode resolve antes), mas se getApprovalScope()
  // e dispatch() divergirem, o modo de falha tem que ser uma resposta de erro —
  // não uma call sem resposta.
  it('answers every call, including one dispatch rejects with approval_required', async () => {
    const registry = fakeRegistry(() => ({
      status: 'approval_required',
      scope: 'feature-flags:write',
    }));
    const calls: ToolCall[] = [
      { id: 'tc1', name: 'toggle_feature_flag', args: { id: 'f1', enabled: true } },
    ];

    const res = await executeToolCalls(calls, ctx, registry);

    expect(res.outcomes).toHaveLength(1);
    expect(res.outcomes[0].toolCallId).toBe('tc1');
    expect(res.outcomes[0].message.status).toBe('error');
    expect(res.outcomes[0].result).toEqual({
      error: 'Aprovação pendente não resolvida para o scope feature-flags:write',
    });
  });

  it('runs the calls of a turn in parallel and answers each one, in the original order', async () => {
    const registry = fakeRegistry((name) =>
      name === 'toggle_feature_flag'
        ? { status: 'error', message: 'boom' }
        : { status: 'ok', result: { count: 3 } },
    );
    const calls: ToolCall[] = [
      { id: 'tc1', name: 'list_users', args: {} },
      { id: 'tc2', name: 'toggle_feature_flag', args: { id: 'f1', enabled: true } },
      { id: 'tc3', name: 'list_routes', args: {} },
    ];

    const res = await executeToolCalls(calls, ctx, registry);

    expect(registry.dispatch).toHaveBeenCalledTimes(3);
    expect(res.outcomes.map((o) => o.toolCallId)).toEqual(['tc1', 'tc2', 'tc3']);
    expect(res.outcomes.map((o) => o.message.status)).toEqual([
      'success',
      'error',
      'success',
    ]);
  });
});
