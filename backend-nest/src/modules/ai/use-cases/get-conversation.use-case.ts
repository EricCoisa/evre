import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiCheckpointerService } from '../checkpointer.service';
import { getConversationHistory } from '../graph/agent-graph';
import type { AiChatMessage } from 'src/domain/interface/ai-provider.interface';

export interface AiConversationDetail {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages: AiChatMessage[];
}

@Injectable()
export class GetConversationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkpointer: AiCheckpointerService,
  ) {}

  async execute(id: string, userId: string): Promise<AiConversationDetail> {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, userId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    const messages = await getConversationHistory(this.checkpointer.saver, id);

    return { ...conversation, messages };
  }
}
