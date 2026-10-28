import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { RewindConversationUseCase } from './rewind-conversation.use-case';
import { rewindConversation, getPendingApproval } from '../graph/agent-graph';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AiService } from '../ai.service';
import type { ToolRegistry } from '../tool-registry.service';
import type { AiCheckpointerService } from '../checkpointer.service';
import type { LoggingService } from '../../logging/logging.service';

vi.mock('../graph/agent-graph', () => ({
  rewindConversation: vi.fn(),
  getPendingApproval: vi.fn(),
}));

function setup(conversation: { id: string; userId: string } | null = { id: 'c1', userId: 'u1' }) {
  const prisma = {
    aiConversation: { findFirst: vi.fn().mockResolvedValue(conversation) },
  } as unknown as PrismaService;
  const aiService = {} as AiService;
  const toolRegistry = {} as ToolRegistry;
  const checkpointer = { saver: { fakeSaver: true } } as unknown as AiCheckpointerService;
  const loggingService = { create: vi.fn().mockResolvedValue(undefined) } as unknown as LoggingService;

  const useCase = new RewindConversationUseCase(
    prisma,
    aiService,
    toolRegistry,
    checkpointer,
    loggingService,
  );

  return { useCase, prisma, loggingService };
}

function run(useCase: RewindConversationUseCase, overrides: Partial<Parameters<RewindConversationUseCase['execute']>[0]> = {}) {
  return useCase.execute({
    conversationId: 'c1',
    userId: 'u1',
    roleName: 'ADMIN',
    messageId: 'm2',
    ...overrides,
  });
}

describe('RewindConversationUseCase', () => {
  beforeEach(() => {
    vi.mocked(rewindConversation).mockReset();
    vi.mocked(getPendingApproval).mockReset().mockResolvedValue(undefined);
  });

  it('throws NotFoundException when the conversation does not exist (or is not owned by the user)', async () => {
    const { useCase } = setup(null);
    await expect(run(useCase)).rejects.toThrow(NotFoundException);
    expect(getPendingApproval).not.toHaveBeenCalled();
  });

  // Achado #6 da revisão: rewindConversation trunca o estado do grafo direto,
  // sem passar pelo node "tools" — um interrupt() pendente não é resolvido
  // nem cancelado, só fica órfão apontando pra uma tool call que já não existe
  // mais no histórico. Barra antes de chegar lá, mesma revalidação que
  // ResolveApprovalUseCase já faz antes de retomar.
  it('throws ConflictException instead of truncating when there is a pending approval on the thread', async () => {
    const { useCase } = setup();
    vi.mocked(getPendingApproval).mockResolvedValue({
      toolCallId: 'tc1',
      tool: 'delete_user',
      scope: 'user:write',
      input: {},
    });

    await expect(run(useCase)).rejects.toThrow(ConflictException);
    expect(rewindConversation).not.toHaveBeenCalled();
  });

  it('rewinds and logs when there is no pending approval', async () => {
    const { useCase, loggingService } = setup();
    vi.mocked(rewindConversation).mockResolvedValue([
      { role: 'user', content: 'oi', id: 'm1' },
    ]);

    const result = await run(useCase);

    expect(rewindConversation).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 'c1', messageId: 'm2' }),
    );
    expect(result).toEqual([{ role: 'user', content: 'oi', id: 'm1' }]);
    expect(loggingService.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AI_CONVERSATION_REWOUND' }),
      'u1',
    );
  });
});
