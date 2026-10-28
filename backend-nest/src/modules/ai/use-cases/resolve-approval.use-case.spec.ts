import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import type { AiStreamEvent } from 'src/domain/interface/ai-provider.interface';
import { LogActions } from 'src/domain/logging/log-actions';
import { ResolveApprovalUseCase } from './resolve-approval.use-case';
import { runAgentGraph, getPendingApproval } from '../graph/agent-graph';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AiService } from '../ai.service';
import type { ToolRegistry } from '../tool-registry.service';
import type { AiCheckpointerService } from '../checkpointer.service';
import type { LoggingService } from '../../logging/logging.service';
import type { RedisService } from '../../../common/infrastructure/redis/redis.service';

vi.mock('../graph/agent-graph', () => ({
  runAgentGraph: vi.fn(),
  getPendingApproval: vi.fn(),
}));

async function collect(gen: AsyncGenerator<AiStreamEvent>): Promise<AiStreamEvent[]> {
  const out: AiStreamEvent[] = [];
  for await (const event of gen) out.push(event);
  return out;
}

async function* eventsOf(...events: AiStreamEvent[]) {
  for (const e of events) yield e;
}

const PENDING = { toolCallId: 'tc1', tool: 'delete_user', scope: 'user:write', input: { id: 'u2' } };

function setup() {
  const prisma = {
    aiConversation: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
  } as unknown as PrismaService;
  const aiService = {
    buildSystemPrompt: vi.fn().mockResolvedValue('system prompt'),
  } as unknown as AiService;
  const toolRegistry = {} as ToolRegistry;
  const checkpointer = {
    saver: { fakeSaver: true },
    pool: {
      connect: () =>
        Promise.resolve({
          query: () => Promise.resolve(undefined),
          release: () => {},
        }),
    },
  } as unknown as AiCheckpointerService;
  const loggingService = { create: vi.fn().mockResolvedValue(undefined) } as unknown as LoggingService;
  const redis = {
    setnx: vi.fn().mockResolvedValue(true),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  } as unknown as RedisService;

  const useCase = new ResolveApprovalUseCase(
    prisma,
    aiService,
    toolRegistry,
    checkpointer,
    loggingService,
    redis,
  );

  return { useCase, prisma, loggingService, redis };
}

function run(useCase: ResolveApprovalUseCase, overrides: Partial<Parameters<ResolveApprovalUseCase['execute']>[0]> = {}) {
  return collect(
    useCase.execute({
      conversationId: 'c1',
      userId: 'u1',
      roleName: 'ADMIN',
      toolCallId: 'tc1',
      decision: 'once',
      ...overrides,
    }),
  );
}

describe('ResolveApprovalUseCase', () => {
  beforeEach(() => {
    vi.mocked(runAgentGraph).mockReset();
    vi.mocked(getPendingApproval).mockReset().mockResolvedValue(PENDING);
  });

  it('throws NotFoundException when the conversation does not exist (or is not owned by the user)', async () => {
    const { useCase, prisma } = setup();
    vi.mocked(prisma.aiConversation.findFirst).mockResolvedValue(null);
    await expect(run(useCase)).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when there is no pending approval at all', async () => {
    const { useCase } = setup();
    vi.mocked(getPendingApproval).mockResolvedValue(undefined);
    await expect(run(useCase)).rejects.toThrow(/não encontrada ou já resolvida/);
  });

  it('throws ConflictException when the pending approval is for a different toolCallId', async () => {
    const { useCase } = setup();
    vi.mocked(getPendingApproval).mockResolvedValue({ ...PENDING, toolCallId: 'tc-other' });
    await expect(run(useCase, { toolCallId: 'tc1' })).rejects.toThrow(/não encontrada ou já resolvida/);
  });

  it('throws ConflictException when the conversation lock is already held', async () => {
    const { useCase, redis } = setup();
    vi.mocked(redis.setnx).mockResolvedValue(false);
    await expect(run(useCase)).rejects.toThrow(ConflictException);
  });

  it('resumes the agent graph on the right thread with the decision, ignoring messages', async () => {
    const { useCase } = setup();
    vi.mocked(runAgentGraph).mockReturnValue(eventsOf({ type: 'done' }));

    await run(useCase, { decision: 'conversation' });

    expect(runAgentGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        resume: 'conversation',
        threadId: 'c1',
        messages: [],
        checkpointer: { fakeSaver: true },
      }),
    );
  });

  it('yields every event the graph produces, unchanged', async () => {
    const { useCase } = setup();
    vi.mocked(runAgentGraph).mockReturnValue(
      eventsOf({ type: 'tool_result', toolCallId: 'tc1', result: { ok: true } }, { type: 'done' }),
    );

    const events = await run(useCase);

    expect(events).toEqual([
      { type: 'tool_result', toolCallId: 'tc1', result: { ok: true } },
      { type: 'done' },
    ]);
  });

  it('logs AI_TOOL_DENIED (not AI_SCOPE_APPROVED) when the decision is deny', async () => {
    const { useCase, loggingService } = setup();
    vi.mocked(runAgentGraph).mockReturnValue(eventsOf({ type: 'done' }));

    await run(useCase, { decision: 'deny' });

    expect(loggingService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: LogActions.AI_TOOL_DENIED,
        metadata: { tool: 'delete_user' },
      }),
      'u1',
    );
  });

  it('logs AI_SCOPE_APPROVED with the scope and mode when the decision approves', async () => {
    const { useCase, loggingService } = setup();
    vi.mocked(runAgentGraph).mockReturnValue(eventsOf({ type: 'done' }));

    await run(useCase, { decision: 'once' });

    expect(loggingService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { scope: 'user:write', mode: 'once', tool: 'delete_user' },
      }),
      'u1',
    );
  });

  it('also logs AI_MESSAGE_SENT when the resumed turn completes cleanly', async () => {
    const { useCase, loggingService } = setup();
    vi.mocked(runAgentGraph).mockReturnValue(
      eventsOf({ type: 'text', text: 'feito' }, { type: 'done' }),
    );

    await run(useCase);

    expect(loggingService.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: expect.stringMatching(/AI_MESSAGE_SENT/i) }),
      'u1',
    );
  });

  it('does not log AI_MESSAGE_SENT when the resumed turn hits another approval_required', async () => {
    const { useCase, loggingService } = setup();
    vi.mocked(runAgentGraph).mockReturnValue(
      eventsOf(
        { type: 'approval_required', toolCallId: 'tc2', tool: 'delete_role', scope: 'role:write', input: {} },
        { type: 'done' },
      ),
    );

    await run(useCase);

    const calls = vi.mocked(loggingService.create).mock.calls;
    expect(calls.some(([entry]) => (entry as { action: string }).action.match(/AI_MESSAGE_SENT/i))).toBe(false);
  });

  it('always releases the conversation lock, even when the graph throws', async () => {
    const { useCase, redis } = setup();
    vi.mocked(runAgentGraph).mockImplementation(async function* () {
      throw new Error('boom');
    });

    await expect(run(useCase)).rejects.toThrow('boom');

    expect(redis.del).toHaveBeenCalledWith('ai:conv:c1:lock');
  });
});
