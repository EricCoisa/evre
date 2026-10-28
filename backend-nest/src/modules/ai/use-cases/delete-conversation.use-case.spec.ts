import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DeleteConversationUseCase } from './delete-conversation.use-case';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AiCheckpointerService } from '../checkpointer.service';

describe('DeleteConversationUseCase', () => {
  it('throws NotFoundException when the conversation does not exist (or is not owned by the user), without touching the checkpoint', async () => {
    const prisma = {
      aiConversation: { findFirst: vi.fn().mockResolvedValue(null), delete: vi.fn() },
    } as unknown as PrismaService;
    const deleteThread = vi.fn();
    const checkpointer = { saver: { deleteThread } } as unknown as AiCheckpointerService;

    await expect(
      new DeleteConversationUseCase(prisma, checkpointer).execute('c1', 'u1'),
    ).rejects.toThrow(NotFoundException);
    expect(deleteThread).not.toHaveBeenCalled();
  });

  it('deletes the Prisma row and the checkpoint thread — Prisma first, so a failed checkpoint cleanup never orphans a visible conversation', async () => {
    const calls: string[] = [];
    const prisma = {
      aiConversation: {
        findFirst: vi.fn().mockResolvedValue({ id: 'c1' }),
        delete: vi.fn().mockImplementation(async () => {
          calls.push('prisma.delete');
        }),
      },
    } as unknown as PrismaService;
    const deleteThread = vi.fn().mockImplementation(async () => {
      calls.push('deleteThread');
    });
    const checkpointer = { saver: { deleteThread } } as unknown as AiCheckpointerService;

    await new DeleteConversationUseCase(prisma, checkpointer).execute('c1', 'u1');

    expect(prisma.aiConversation.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(deleteThread).toHaveBeenCalledWith('c1');
    expect(calls).toEqual(['prisma.delete', 'deleteThread']);
  });
});
