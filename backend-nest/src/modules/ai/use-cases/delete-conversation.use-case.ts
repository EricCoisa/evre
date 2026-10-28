import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiCheckpointerService } from '../checkpointer.service';

@Injectable()
export class DeleteConversationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkpointer: AiCheckpointerService,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, userId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    await this.prisma.aiConversation.delete({
      where: { id },
    });
    // Prisma primeiro; falha no deleteThread deixa checkpoint órfão, nunca histórico sem dono.
    await this.checkpointer.saver.deleteThread(id);
  }
}
