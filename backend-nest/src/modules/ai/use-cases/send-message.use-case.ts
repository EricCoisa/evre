import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiService } from '../ai.service';
import { ToolRegistry } from '../tool-registry.service';
import { AiCheckpointerService } from '../checkpointer.service';
import { LoggingService } from '../../logging/logging.service';
import { RedisService } from '../../../common/infrastructure/redis/redis.service';
import type { AiStreamEvent } from 'src/domain/interface/ai-provider.interface';
import type { ScreenItem } from 'src/domain/ai/screen-context.const';
import { runAgentGraph } from '../graph/agent-graph';
import {
  runConversationTurn,
  MAX_TOOL_ITERATIONS,
} from './run-conversation-turn';

@Injectable()
export class SendMessageUseCase {
  private readonly logger = new Logger(SendMessageUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly toolRegistry: ToolRegistry,
    private readonly checkpointer: AiCheckpointerService,
    private readonly loggingService: LoggingService,
    private readonly redis: RedisService,
  ) {}

  async *execute(params: {
    conversationId: string;
    userId: string;
    roleName: string;
    content: string;
    model?: string;
    /** Tela aberta no front (path + query) — contexto do turno. */
    page?: string;
    /** O que o front tem montado na tela — ver ScreenItem. */
    screen?: ScreenItem[];
    apiKeyScopes?: string[];
    abortSignal?: AbortSignal;
  }): AsyncGenerator<AiStreamEvent> {
    const {
      conversationId,
      userId,
      roleName,
      content,
      model,
      page,
      screen,
      apiKeyScopes,
      abortSignal,
    } = params;

    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) throw new NotFoundException('Conversa não encontrada');

    const { prisma, aiService, toolRegistry, checkpointer } = this;

    yield* runConversationTurn({
      redis: this.redis,
      pgPool: checkpointer.pool,
      loggingService: this.loggingService,
      logger: this.logger,
      conversationId,
      userId,
      // Só roda depois que o lock foi adquirido — inclusive o título: um
      // segundo envio na mesma conversa leva 409 sem renomear nada.
      run: async function* () {
        if (!conversation.title) {
          await prisma.aiConversation.update({
            where: { id: conversationId },
            data: { title: content.slice(0, 50) },
          });
        }

        yield* runAgentGraph({
          messages: [{ role: 'user', content }],
          ctx: { userId, roleName, approvedScopes: apiKeyScopes ?? [] },
          system: await aiService.buildSystemPrompt(userId, {
            page,
            items: screen,
            roleName,
          }),
          model,
          abortSignal,
          aiService,
          toolRegistry,
          checkpointer: checkpointer.saver,
          threadId: conversationId,
          maxIterations: MAX_TOOL_ITERATIONS,
        });
      },
    });
  }
}
