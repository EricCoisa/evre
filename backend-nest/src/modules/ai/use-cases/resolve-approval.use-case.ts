import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ResolveApprovalDto } from '../dto/resolve-approval.dto';
import { AiService } from '../ai.service';
import { ToolRegistry } from '../tool-registry.service';
import { AiCheckpointerService } from '../checkpointer.service';
import { LoggingService } from '../../logging/logging.service';
import { RedisService } from '../../../common/infrastructure/redis/redis.service';
import type { AiStreamEvent } from 'src/domain/interface/ai-provider.interface';
import { LogActions } from 'src/domain/logging/log-actions';
import type { ScreenItem } from 'src/domain/ai/screen-context.const';
import { runAgentGraph, getPendingApproval } from '../graph/agent-graph';
import {
  runConversationTurn,
  MAX_TOOL_ITERATIONS,
} from './run-conversation-turn';

@Injectable()
export class ResolveApprovalUseCase {
  private readonly logger = new Logger(ResolveApprovalUseCase.name);

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
    toolCallId: string;
    decision: ResolveApprovalDto['decision'];
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
      toolCallId,
      decision,
      page,
      screen,
      apiKeyScopes,
      abortSignal,
    } = params;

    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) throw new NotFoundException('Conversa não encontrada');

    // Mesmos scopes do envio original: a retomada não pode enxergar menos que o turno que a originou.
    const graphDeps = {
      ctx: { userId, roleName, approvedScopes: apiKeyScopes ?? [] },
      system: await this.aiService.buildSystemPrompt(userId, {
        page,
        items: screen,
        roleName,
      }),
      aiService: this.aiService,
      toolRegistry: this.toolRegistry,
      checkpointer: this.checkpointer.saver,
      threadId: conversationId,
    };

    // Revalida antes de tocar no lock/checkpoint: tem de ser a tool call pendurada nesta thread.
    const pending = await getPendingApproval(graphDeps);
    if (!pending || pending.toolCallId !== toolCallId) {
      throw new ConflictException('Tool call não encontrada ou já resolvida');
    }

    const loggingService = this.loggingService;

    yield* runConversationTurn({
      redis: this.redis,
      pgPool: this.checkpointer.pool,
      loggingService,
      logger: this.logger,
      conversationId,
      userId,
      run: async function* () {
        await loggingService.create(
          decision === 'deny'
            ? {
                module: 'AI',
                action: LogActions.AI_TOOL_DENIED,
                message: `Tool ${pending.tool} negada pelo usuário`,
                metadata: { tool: pending.tool },
              }
            : {
                module: 'AI',
                action: LogActions.AI_SCOPE_APPROVED,
                message: `Scope ${pending.scope} aprovado (${decision})`,
                metadata: {
                  scope: pending.scope,
                  mode: decision,
                  tool: pending.tool,
                },
              },
          userId,
        );

        yield* runAgentGraph({
          ...graphDeps,
          messages: [],
          maxIterations: MAX_TOOL_ITERATIONS,
          resume: decision,
          abortSignal,
        });
      },
    });
  }
}
