import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiService } from '../ai.service';
import { ToolRegistry } from '../tool-registry.service';
import { AiCheckpointerService } from '../checkpointer.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { AiChatMessage } from 'src/domain/interface/ai-provider.interface';
import { rewindConversation, getPendingApproval } from '../graph/agent-graph';

/** Descarta a mensagem informada e tudo que veio depois dela, na mesma conversa. */
@Injectable()
export class RewindConversationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly toolRegistry: ToolRegistry,
    private readonly checkpointer: AiCheckpointerService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(params: {
    conversationId: string;
    userId: string;
    roleName: string;
    messageId: string;
  }): Promise<AiChatMessage[]> {
    const { conversationId, userId, roleName, messageId } = params;

    // Mesma porta de entrada de autorização do resto do módulo: o checkpoint
    // não sabe de dono, quem sabe é AiConversation.
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) throw new NotFoundException('Conversa não encontrada');

    const graphDeps = {
      ctx: { userId, roleName, approvedScopes: [] },
      aiService: this.aiService,
      toolRegistry: this.toolRegistry,
      checkpointer: this.checkpointer.saver,
      threadId: conversationId,
    };

    // Revalida o interrupt() pendente: o rewind trunca o estado sem passar pelo node "tools".
    const pending = await getPendingApproval(graphDeps);
    if (pending) {
      throw new ConflictException(
        'Conversa tem uma aprovação pendente — resolva-a antes de rebobinar',
      );
    }

    const messages = await rewindConversation({
      ...graphDeps,
      messageId,
    });

    await this.loggingService.create(
      {
        module: 'AI',
        action: LogActions.AI_CONVERSATION_REWOUND,
        message: 'Conversa retomada a partir de um ponto anterior',
        metadata: { conversationId, messageId },
      },
      userId,
    );

    return messages;
  }
}
