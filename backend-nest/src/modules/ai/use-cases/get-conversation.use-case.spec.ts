import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { GetConversationUseCase } from './get-conversation.use-case';
import { getConversationHistory } from '../graph/agent-graph';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AiCheckpointerService } from '../checkpointer.service';

vi.mock('../graph/agent-graph', () => ({ getConversationHistory: vi.fn() }));

describe('GetConversationUseCase', () => {
  beforeEach(() => {
    vi.mocked(getConversationHistory).mockReset();
  });

  it('throws NotFoundException when the conversation does not exist (or is not owned by the user)', async () => {
    const prisma = {
      aiConversation: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const checkpointer = { saver: {} } as unknown as AiCheckpointerService;
    const useCase = new GetConversationUseCase(prisma, checkpointer);

    await expect(useCase.execute('c1', 'u1')).rejects.toThrow(NotFoundException);
  });

  it('merges Prisma metadata with the message history read from the checkpoint', async () => {
    const conversation = {
      id: 'c1',
      userId: 'u1',
      title: 'Título',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
    };
    const prisma = {
      aiConversation: { findFirst: vi.fn().mockResolvedValue(conversation) },
    } as unknown as PrismaService;
    const saver = { fakeSaver: true };
    const checkpointer = { saver } as unknown as AiCheckpointerService;
    vi.mocked(getConversationHistory).mockResolvedValue([
      { role: 'user', content: 'oi', id: 'm1' },
      { role: 'assistant', content: 'olá!', id: 'm2' },
    ]);

    const result = await new GetConversationUseCase(prisma, checkpointer).execute('c1', 'u1');

    expect(getConversationHistory).toHaveBeenCalledWith(saver, 'c1');
    expect(result).toEqual({
      ...conversation,
      messages: [
        { role: 'user', content: 'oi', id: 'm1' },
        { role: 'assistant', content: 'olá!', id: 'm2' },
      ],
    });
  });
});
