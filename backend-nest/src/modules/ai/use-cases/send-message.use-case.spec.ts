import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import type { AiStreamEvent } from 'src/domain/interface/ai-provider.interface';
import { SendMessageUseCase } from './send-message.use-case';
import { runAgentGraph } from '../graph/agent-graph';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AiService } from '../ai.service';
import type { ToolRegistry } from '../tool-registry.service';
import type { AiCheckpointerService } from '../checkpointer.service';
import type { LoggingService } from '../../logging/logging.service';
import type { RedisService } from '../../../common/infrastructure/redis/redis.service';

vi.mock('../graph/agent-graph', () => ({ runAgentGraph: vi.fn() }));

async function collect(gen: AsyncGenerator<AiStreamEvent>): Promise<AiStreamEvent[]> {
  const out: AiStreamEvent[] = [];
  for await (const event of gen) out.push(event);
  return out;
}

function setup(conversation: { title: string | null } | null = { title: 'Já tem título' }) {
  const prisma = {
    aiConversation: {
      findFirst: vi.fn().mockResolvedValue(conversation),
      update: vi.fn().mockResolvedValue(undefined),
    },
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

  const useCase = new SendMessageUseCase(
    prisma,
    aiService,
    toolRegistry,
    checkpointer,
    loggingService,
    redis,
  );

  return { useCase, prisma, aiService, toolRegistry, checkpointer, loggingService, redis };
}

async function* eventsOf(...events: AiStreamEvent[]) {
  for (const e of events) yield e;
}

describe('SendMessageUseCase', () => {
  beforeEach(() => {
    vi.mocked(runAgentGraph).mockReset();
  });

  it('throws NotFoundException when the conversation does not exist (or is not owned by the user)', async () => {
    const { useCase } = setup(null);
    await expect(
      collect(
        useCase.execute({
          conversationId: 'c1',
          userId: 'u1',
          roleName: 'ADMIN',
          content: 'oi',
        }),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when the conversation lock is already held', async () => {
    const { useCase, redis } = setup();
    vi.mocked(redis.setnx).mockResolvedValue(false);
    await expect(
      collect(
        useCase.execute({
          conversationId: 'c1',
          userId: 'u1',
          roleName: 'ADMIN',
          content: 'oi',
        }),
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('sets the title from the first message only when the conversation has none yet', async () => {
    const { useCase, prisma } = setup({ title: null });
    vi.mocked(runAgentGraph).mockReturnValue(eventsOf({ type: 'done' }));

    await collect(
      useCase.execute({
        conversationId: 'c1',
        userId: 'u1',
        roleName: 'ADMIN',
        content: 'Explica o módulo de auth pra mim',
      }),
    );

    expect(prisma.aiConversation.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { title: 'Explica o módulo de auth pra mim' },
    });
  });

  it('does not touch the title when the conversation already has one', async () => {
    const { useCase, prisma } = setup({ title: 'Já tem título' });
    vi.mocked(runAgentGraph).mockReturnValue(eventsOf({ type: 'done' }));

    await collect(
      useCase.execute({ conversationId: 'c1', userId: 'u1', roleName: 'ADMIN', content: 'oi' }),
    );

    expect(prisma.aiConversation.update).not.toHaveBeenCalled();
  });

  it('runs the agent graph threaded on the conversation id, seeding ctx.approvedScopes only from apiKeyScopes', async () => {
    const { useCase } = setup();
    vi.mocked(runAgentGraph).mockReturnValue(eventsOf({ type: 'done' }));

    await collect(
      useCase.execute({
        conversationId: 'c1',
        userId: 'u1',
        roleName: 'ADMIN',
        content: 'oi',
        apiKeyScopes: ['user:write'],
      }),
    );

    expect(runAgentGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'oi' }],
        ctx: { userId: 'u1', roleName: 'ADMIN', approvedScopes: ['user:write'] },
        threadId: 'c1',
        checkpointer: { fakeSaver: true },
      }),
    );
  });

  it('yields every event the graph produces, unchanged', async () => {
    const { useCase } = setup();
    vi.mocked(runAgentGraph).mockReturnValue(
      eventsOf({ type: 'text', text: 'oi!' }, { type: 'done' }),
    );

    const events = await collect(
      useCase.execute({ conversationId: 'c1', userId: 'u1', roleName: 'ADMIN', content: 'oi' }),
    );

    expect(events).toEqual([{ type: 'text', text: 'oi!' }, { type: 'done' }]);
  });

  it('logs AI_MESSAGE_SENT when the turn completes without an approval or an error', async () => {
    const { useCase, loggingService } = setup();
    vi.mocked(runAgentGraph).mockReturnValue(eventsOf({ type: 'text', text: 'oi!' }, { type: 'done' }));

    await collect(
      useCase.execute({ conversationId: 'c1', userId: 'u1', roleName: 'ADMIN', content: 'oi' }),
    );

    expect(loggingService.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: expect.stringMatching(/AI_MESSAGE_SENT/i) }),
      'u1',
    );
  });

  it('does not log AI_MESSAGE_SENT when the turn stops on approval_required', async () => {
    const { useCase, loggingService } = setup();
    vi.mocked(runAgentGraph).mockReturnValue(
      eventsOf(
        { type: 'approval_required', toolCallId: 't1', tool: 'delete_user', scope: 'user:write', input: {} },
        { type: 'done' },
      ),
    );

    await collect(
      useCase.execute({ conversationId: 'c1', userId: 'u1', roleName: 'ADMIN', content: 'apaga o user 1' }),
    );

    expect(loggingService.create).not.toHaveBeenCalled();
  });

  it('does not log AI_MESSAGE_SENT when the turn errors', async () => {
    const { useCase, loggingService } = setup();
    vi.mocked(runAgentGraph).mockReturnValue(
      eventsOf({ type: 'error', message: 'boom' }, { type: 'done' }),
    );

    await collect(
      useCase.execute({ conversationId: 'c1', userId: 'u1', roleName: 'ADMIN', content: 'oi' }),
    );

    expect(loggingService.create).not.toHaveBeenCalled();
  });

  it('always releases the conversation lock, even when the graph throws', async () => {
    const { useCase, redis } = setup();
    vi.mocked(runAgentGraph).mockImplementation(async function* () {
      throw new Error('boom');
    });

    await expect(
      collect(
        useCase.execute({ conversationId: 'c1', userId: 'u1', roleName: 'ADMIN', content: 'oi' }),
      ),
    ).rejects.toThrow('boom');

    expect(redis.del).toHaveBeenCalledWith('ai:conv:c1:lock');
  });

  // O consumo de tokens não tem mais tabela própria (o model AiMessage, com seu
  // campo `usage`, saiu junto com a migração pro checkpoint) — o log de
  // auditoria é o único lugar onde ele fica, e não é backfillável depois.
  it('carries the turn token usage into the AI_MESSAGE_SENT audit log', async () => {
    const { useCase, loggingService } = setup();
    vi.mocked(runAgentGraph).mockReturnValue(
      eventsOf(
        { type: 'text', text: 'oi!' },
        { type: 'done', usage: { inputTokens: 120, outputTokens: 30 } },
      ),
    );

    await collect(
      useCase.execute({ conversationId: 'c1', userId: 'u1', roleName: 'ADMIN', content: 'oi' }),
    );

    expect(loggingService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { conversationId: 'c1', usage: { inputTokens: 120, outputTokens: 30 } },
      }),
      'u1',
    );
  });

  // O refresh do lock roda num callback de setInterval, fora de qualquer try do
  // turno: sem `.catch()`, uma rejeição do Redis vira unhandled rejection e
  // derruba o processo — não só o turno.
  it('survives the conversation lock refresh failing mid-turn', async () => {
    vi.useFakeTimers();
    try {
      const { useCase, redis } = setup();
      vi.mocked(redis.set).mockRejectedValue(new Error('redis indisponível'));

      let release!: () => void;
      const midTurn = new Promise<void>((resolve) => {
        release = resolve;
      });
      vi.mocked(runAgentGraph).mockReturnValue(
        (async function* () {
          yield { type: 'text', text: 'parcial' } as AiStreamEvent;
          await midTurn; // turno longo o bastante pra o refresh disparar
          yield { type: 'done' } as AiStreamEvent;
        })(),
      );

      const events: AiStreamEvent[] = [];
      const turn = (async () => {
        for await (const event of useCase.execute({
          conversationId: 'c1',
          userId: 'u1',
          roleName: 'ADMIN',
          content: 'oi',
        })) {
          events.push(event);
        }
      })();

      // TTL do lock é 60s, refresh a cada 30s.
      await vi.advanceTimersByTimeAsync(31_000);
      release();
      await turn;

      expect(redis.set).toHaveBeenCalledWith('ai:conv:c1:lock', '1', 60);
      expect(events).toEqual([{ type: 'text', text: 'parcial' }, { type: 'done' }]);
      expect(redis.del).toHaveBeenCalledWith('ai:conv:c1:lock');
    } finally {
      vi.useRealTimers();
    }
  });
});
