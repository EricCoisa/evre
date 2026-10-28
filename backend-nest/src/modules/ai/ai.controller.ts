import {
  Controller,
  Param,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AiStreamEvent } from 'src/domain/interface/ai-provider.interface';
import { ApiTags } from '@nestjs/swagger';
import { CreateConversationUseCase } from './use-cases/create-conversation.use-case';
import { SendMessageUseCase } from './use-cases/send-message.use-case';
import { ResolveApprovalUseCase } from './use-cases/resolve-approval.use-case';
import { ListConversationsUseCase } from './use-cases/list-conversations.use-case';
import { GetConversationUseCase } from './use-cases/get-conversation.use-case';
import { DeleteConversationUseCase } from './use-cases/delete-conversation.use-case';
import { RewindConversationUseCase } from './use-cases/rewind-conversation.use-case';
import { ListMyToolPermissionsUseCase } from './use-cases/list-my-tool-permissions.use-case';
import { RevokeMyToolAccessUseCase } from './use-cases/revoke-my-tool-access.use-case';
import { AllowMyToolAccessUseCase } from './use-cases/allow-my-tool-access.use-case';
import { AiService } from './ai.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendAiMessageDto } from './dto/send-message.dto';
import { ResolveApprovalDto } from './dto/resolve-approval.dto';
import { RewindConversationDto } from './dto/rewind-conversation.dto';
import { ToolRegistry } from './tool-registry.service';
import {
  GetApi,
  PostApi,
  PutApi,
  DeleteApi,
} from '../../common/decorators/api-method.decorator';
import { SaveAiConfigDto } from './dto/save-ai-config.dto';
import { ListAiModelsDto } from './dto/list-ai-models.dto';
import { SaveAiConfigurationUseCase } from './use-cases/save-configuration.use-case';
import { SaveUserAiConfigurationUseCase } from './use-cases/save-user-configuration.use-case';
import { ListCandidateAiModelsUseCase } from './use-cases/list-candidate-models.use-case';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import {
  FeatureFlagGuard,
  RequireFeature,
} from '../feature-flag/feature-flag.guard';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { commonPaginationQueries } from '../../common/swagger/pagination-queries';
import {
  PaginationQuerySchema,
  type PaginationQuery,
} from '../../common/schemas/pagination.schema';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly createConversationUseCase: CreateConversationUseCase,
    private readonly sendMessageUseCase: SendMessageUseCase,
    private readonly resolveApprovalUseCase: ResolveApprovalUseCase,
    private readonly listConversationsUseCase: ListConversationsUseCase,
    private readonly getConversationUseCase: GetConversationUseCase,
    private readonly deleteConversationUseCase: DeleteConversationUseCase,
    private readonly rewindConversationUseCase: RewindConversationUseCase,
    private readonly listMyToolPermissionsUseCase: ListMyToolPermissionsUseCase,
    private readonly revokeMyToolAccessUseCase: RevokeMyToolAccessUseCase,
    private readonly allowMyToolAccessUseCase: AllowMyToolAccessUseCase,
    private readonly saveAiConfiguration: SaveAiConfigurationUseCase,
    private readonly saveUserAiConfiguration: SaveUserAiConfigurationUseCase,
    private readonly listCandidateAiModels: ListCandidateAiModelsUseCase,
    private readonly aiService: AiService,
    private readonly toolRegistry: ToolRegistry,
  ) {}

  @PostApi({
    path: 'conversations',
    summary: 'Create conversation',
    authenticated: true,
    scope: 'agent:chat',
    status: 'CREATED',
  })
  async createConversation(
    @Body() dto: CreateConversationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createConversationUseCase.execute(dto, user.id);
  }

  @GetApi({
    path: 'conversations',
    summary: 'List conversations',
    authenticated: true,
    scope: 'agent:chat',
    queries: commonPaginationQueries,
  })
  async listConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(PaginationQuerySchema))
    query: PaginationQuery,
  ) {
    return this.listConversationsUseCase.execute(query, user.id);
  }

  @GetApi({
    path: 'conversations/:id',
    summary: 'Get conversation',
    authenticated: true,
    scope: 'agent:chat',
  })
  async getConversation(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getConversationUseCase.execute(id, user.id);
  }

  // @UseGuards acima de @PostApi: o FeatureFlagGuard lê request.user e precisa rodar após a auth.
  @UseGuards(FeatureFlagGuard)
  @RequireFeature('AI_AGENT')
  @PostApi({
    path: 'conversations/:id/messages',
    summary: 'Send message (SSE stream)',
    authenticated: true,
    scope: 'agent:chat',
  })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: SendAiMessageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const abort = new AbortController();
    res.on('close', () => abort.abort());

    const stream = this.sendMessageUseCase.execute({
      conversationId: id,
      userId: user.id,
      roleName: user.roleName,
      content: dto.content,
      model: dto.model,
      page: dto.page,
      screen: dto.screen,
      apiKeyScopes: (req as { apiKeyScopes?: string[] }).apiKeyScopes,
      abortSignal: abort.signal,
    });

    await this.pipeStream(stream, res);
  }

  // @UseGuards above @PostApi so auth runs before FeatureFlagGuard (see sendMessage).
  @UseGuards(FeatureFlagGuard)
  @RequireFeature('AI_AGENT')
  @PostApi({
    path: 'conversations/:id/approvals',
    summary: 'Resolve tool approval (SSE stream)',
    authenticated: true,
  })
  async resolveApproval(
    @Param('id') id: string,
    @Body() dto: ResolveApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const abort = new AbortController();
    res.on('close', () => abort.abort());

    const stream = this.resolveApprovalUseCase.execute({
      conversationId: id,
      userId: user.id,
      roleName: user.roleName,
      toolCallId: dto.toolCallId,
      decision: dto.decision,
      page: dto.page,
      screen: dto.screen,
      apiKeyScopes: (req as { apiKeyScopes?: string[] }).apiKeyScopes,
      abortSignal: abort.signal,
    });

    await this.pipeStream(stream, res);
  }

  /** Escreve um `AsyncGenerator<AiStreamEvent>` como SSE. */
  private async pipeStream(
    stream: AsyncGenerator<AiStreamEvent>,
    res: Response,
  ): Promise<void> {
    try {
      for await (const event of stream) {
        if (res.writableEnded) break;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      this.logger.error(
        `Stream error: ${String((err as Error)?.message ?? err)}`,
      );
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({ type: 'error', message: String((err as Error)?.message ?? err) })}\n\n`,
        );
      }
    } finally {
      res.end();
    }
  }

  @UseGuards(FeatureFlagGuard)
  @RequireFeature('AI_AGENT')
  @PostApi({
    path: 'conversations/:id/rewind',
    summary: 'Rewind conversation to a previous point',
    description:
      'Descarta a mensagem informada e tudo que veio depois dela, mantendo a mesma conversa. Retorna o histórico já truncado.',
    authenticated: true,
  })
  async rewindConversation(
    @Param('id') id: string,
    @Body() dto: RewindConversationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rewindConversationUseCase.execute({
      conversationId: id,
      userId: user.id,
      roleName: user.roleName,
      messageId: dto.messageId,
    });
  }

  @DeleteApi({
    path: 'conversations/:id',
    summary: 'Delete conversation',
    authenticated: true,
    status: 'NO_CONTENT',
  })
  async deleteConversation(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.deleteConversationUseCase.execute(id, user.id);
  }

  @GetApi({
    path: 'tools',
    summary: 'List tools available to the current user',
    authenticated: true,
  })
  async listTools(@CurrentUser() user: AuthenticatedUser) {
    const tools = await this.toolRegistry.getToolDefinitions({
      roleName: user.roleName,
      userId: user.id,
    });
    return tools.map(({ name, description }) => ({ name, description }));
  }

  @GetApi({
    path: 'tools/permissions',
    summary: 'List agent tool permissions for the current user',
    description:
      'Catálogo completo de tools permitidas pelo role do usuário, cada uma com enabled indicando se o próprio usuário revogou o acesso do agente.',
    authenticated: true,
  })
  async listToolPermissions(@CurrentUser() user: AuthenticatedUser) {
    return this.listMyToolPermissionsUseCase.execute(user.id, user.roleName);
  }

  @DeleteApi({
    path: 'tools/:name/access',
    status: 'NO_CONTENT',
    summary: 'Revoke the agent access to a tool for the current user',
    authenticated: true,
  })
  async revokeToolAccess(
    @Param('name') name: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.revokeMyToolAccessUseCase.execute(user.id, name);
  }

  @PostApi({
    path: 'tools/:name/access',
    summary: 'Restore the agent access to a tool for the current user',
    status: 'OK',
    authenticated: true,
  })
  async allowToolAccess(
    @Param('name') name: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.allowMyToolAccessUseCase.execute(user.id, name);
  }

  @GetApi({
    path: 'health',
    summary: 'Check AI health (non-admin)',
    authenticated: true,
  })
  async checkHealth(@CurrentUser() user: AuthenticatedUser) {
    return this.aiService.checkHealth(user.id);
  }

  /** Valida a configuração da plataforma contra o provider e só persiste se passar. */
  @PutApi({
    path: 'config',
    summary: 'Valida e salva a configuração de IA da plataforma',
    roles: ['ADMIN'],
    body: SaveAiConfigDto,
  })
  async saveConfiguration(
    @Body() dto: SaveAiConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.saveAiConfiguration.execute(dto, user.id);
  }

  /** Mesmo fluxo, escrevendo na configuração do próprio usuário (BYOK). */
  @PutApi({
    path: 'user-config',
    summary: 'Valida e salva a configuração de IA do usuário (BYOK)',
    authenticated: true,
    body: SaveAiConfigDto,
  })
  async saveUserConfiguration(
    @Body() dto: SaveAiConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.saveUserAiConfiguration.execute(user.id, dto);
  }

  @GetApi({
    path: 'models',
    summary: 'List available models for current provider',
    authenticated: true,
  })
  async listModels(@CurrentUser() user: AuthenticatedUser) {
    try {
      return await this.aiService.getModels(user.id);
    } catch {
      // Não configurado → devolve vazio; o select só não popula (não quebra o chat)
      return { models: [], default: '' };
    }
  }

  /** Modelos reais de um provider da plataforma ainda não gravado, para popular o select do formulário. */
  @PostApi({
    path: 'models/candidate',
    summary: 'Lista modelos reais de um provider ainda não salvo',
    roles: ['ADMIN'],
    body: ListAiModelsDto,
  })
  async listCandidateModels(@Body() dto: ListAiModelsDto) {
    return this.listCandidateAiModels.execute(dto);
  }
}
