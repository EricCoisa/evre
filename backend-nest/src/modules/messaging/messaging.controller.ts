import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpStatus,
  Param,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  type RawBodyRequest,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  DeleteApi,
  GetApi,
  PatchApi,
  PostApi,
  PutApi,
} from '../../common/decorators/api-method.decorator';
import {
  FeatureFlagGuard,
  RequireFeature,
} from '../feature-flag/feature-flag.guard';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import {
  MESSAGING_MAX_UPLOAD_BYTES,
  MessagingFeatureFlag,
} from 'src/domain/messaging/messaging.const';
import { parseByteRange } from 'src/common/utils/byte-range.util';
import { assertProviderOk } from 'src/common/utils/provider-result.util';
import {
  MessagingConnectionDto,
  SaveMessagingConnectionDto,
  SaveMessagingConnectionResponseDto,
} from './dto/messaging-connection.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  ListContactsQuerySchema,
  ListConversationsQuerySchema,
  ListMessagesQuerySchema,
  type ListContactsQuery,
  type ListConversationsQuery,
  type ListMessagesQuery,
} from './dto/messaging-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { SendPresenceDto } from './dto/send-presence.dto';
import { MessagingMessageDto } from './dto/messaging-message.dto';
import {
  MessagingCapabilitiesDto,
  MessagingContactDto,
  MessagingConversationSummaryDto,
  SendMessageResponseDto,
} from './dto/messaging-responses.dto';
import { CreateConnectionUseCase } from './use-cases/create-connection.use-case';
import { UpdateConnectionUseCase } from './use-cases/update-connection.use-case';
import { SetDefaultConnectionUseCase } from './use-cases/set-default-connection.use-case';
import { ArchiveConnectionUseCase } from './use-cases/archive-connection.use-case';
import { RestoreConnectionUseCase } from './use-cases/restore-connection.use-case';
import { ListConnectionsUseCase } from './use-cases/list-connections.use-case';
import { CheckConnectionHealthUseCase } from './use-cases/check-health.use-case';
import { ListMessagesUseCase } from './use-cases/list-messages.use-case';
import { ReceiveWebhookUseCase } from './use-cases/receive-webhook.use-case';
import { VerifyWebhookChallengeUseCase } from './use-cases/verify-challenge.use-case';
import { MessagingSessionUseCase } from './use-cases/session.use-case';
import { ListContactsUseCase } from './use-cases/list-contacts.use-case';
import { CreateContactUseCase } from './use-cases/create-contact.use-case';
import { UpdateContactUseCase } from './use-cases/update-contact.use-case';
import {
  SendMessageUseCase,
  type UploadedMedia,
} from './use-cases/send-message.use-case';
import { SendPresenceUseCase } from './use-cases/send-presence.use-case';
import { GetMessageMediaUseCase } from './use-cases/get-message-media.use-case';
import { GetContactPhotoUseCase } from './use-cases/get-contact-photo.use-case';
import { MessagingEventsService } from './messaging-events.service';
import { GetCapabilitiesUseCase } from './use-cases/get-capabilities.use-case';
import { UpdateMessagingContactDto } from './dto/update-messaging-contact.dto';
import { CreateMessagingContactDto } from './dto/create-messaging-contact.dto';
import { ListConversationsUseCase } from './use-cases/list-conversations.use-case';
import { RouteAccess } from 'src/common/decorators/route-access.decorator';
import { RoutePathConst } from 'src/domain/route/route-path.const';

const WEBHOOK_RATE_LIMIT = 1000;

@ApiTags('messaging')
@Controller('messaging')
@RouteAccess(RoutePathConst.COMMUNICATION)
export class MessagingController {
  constructor(
    private readonly sendMessageUseCase: SendMessageUseCase,
    private readonly sendPresenceUseCase: SendPresenceUseCase,
    private readonly getCapabilitiesUseCase: GetCapabilitiesUseCase,
    private readonly listConnections: ListConnectionsUseCase,
    private readonly createConnection: CreateConnectionUseCase,
    private readonly updateConnection: UpdateConnectionUseCase,
    private readonly setDefaultConnection: SetDefaultConnectionUseCase,
    private readonly archiveConnection: ArchiveConnectionUseCase,
    private readonly restoreConnection: RestoreConnectionUseCase,
    private readonly checkHealth: CheckConnectionHealthUseCase,
    private readonly listMessages: ListMessagesUseCase,
    private readonly getMessageMedia: GetMessageMediaUseCase,
    private readonly getContactPhoto: GetContactPhotoUseCase,
    private readonly realtime: MessagingEventsService,
    private readonly receiveWebhook: ReceiveWebhookUseCase,
    private readonly verifyChallenge: VerifyWebhookChallengeUseCase,
    private readonly session: MessagingSessionUseCase,
    private readonly listContacts: ListContactsUseCase,
    private readonly createContact: CreateContactUseCase,
    private readonly updateContact: UpdateContactUseCase,
    private readonly listConversations: ListConversationsUseCase,
  ) {}

  @UseGuards(FeatureFlagGuard)
  @RequireFeature(MessagingFeatureFlag.ROOT)
  @PostApi({
    path: 'messages',
    summary: 'Envia uma mensagem',
    description:
      'JSON: texto, template ou mídia por `mediaUrl` (enfileirado). `multipart/form-data` com o campo `file`: anexo enviado direto ao provider, sem storage, na própria requisição; `type` é opcional e sai do mimetype.',
    status: 'CREATED',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
    body: SendMessageDto,
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Mensagem registrada',
          schema: { dto: SendMessageResponseDto },
        },
      ],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MESSAGING_MAX_UPLOAD_BYTES },
    }),
  )
  async sendMessage(
    @Body() dto: SendMessageDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @UploadedFile() file?: UploadedMedia,
  ): Promise<{ id: string }> {
    const id = await this.sendMessageUseCase.execute(dto, currentUser.id, file);
    return { id };
  }

  @UseGuards(FeatureFlagGuard)
  @RequireFeature(MessagingFeatureFlag.CHAT)
  @PostApi({
    path: 'presence',
    summary: 'Avisa o provider que o operador está digitando ou gravando',
    description:
      'Efêmero: nada é gravado. `connectionId` ausente ou provider sem a capability é aceito e ignorado.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
    body: SendPresenceDto,
  })
  async presence(@Body() dto: SendPresenceDto): Promise<void> {
    await this.sendPresenceUseCase.execute(dto);
  }

  @UseGuards(FeatureFlagGuard)
  @RequireFeature(MessagingFeatureFlag.CHAT)
  @GetApi({
    path: 'messages',
    summary: 'Lista o histórico de mensagens',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_READ,
    queries: [
      { name: 'page', required: false, type: Number },
      { name: 'limit', required: false, type: Number },
      { name: 'connectionId', required: false, type: String },
      { name: 'phone', required: false, type: String },
      { name: 'direction', required: false, enum: ['INBOUND', 'OUTBOUND'] },
    ],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Mensagens, da mais recente para a mais antiga',
          schema: {
            dto: MessagingMessageDto,
            isArray: true,
            isPagination: true,
          },
        },
      ],
    },
  })
  async list(
    @Query(new ZodValidationPipe(ListMessagesQuerySchema))
    query: ListMessagesQuery,
  ) {
    return this.listMessages.execute(query);
  }

  @UseGuards(FeatureFlagGuard)
  @RequireFeature(MessagingFeatureFlag.CHAT)
  @GetApi({
    path: 'messages/:id/media',
    summary: 'Baixa a mídia de uma mensagem direto do provider',
    description:
      'Os arquivos não são guardados pela aplicação: cada chamada busca no provider. Só tipos de exibição segura saem `inline`; o resto força download.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_READ,
  })
  async media(
    @Param('id') id: string,
    @Headers('range') range: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | void> {
    const media = await this.getMessageMedia.execute(id);
    const size = media.data.length;
    const name = media.fileName
      ? `; filename*=UTF-8''${encodeURIComponent(media.fileName)}`
      : '';
    res.set({
      'Content-Type': media.mimeType,
      'Content-Disposition': `${media.inline ? 'inline' : 'attachment'}${name}`,
      // Defesa em profundidade: mesmo um tipo inesperado não executa script no domínio do painel.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': 'sandbox',
      // A mensagem não muda: o navegador reaproveita em vez de rebaixar a cada polling.
      'Cache-Control': 'private, max-age=3600',
      // <audio> e <video> pedem por Range para avançar; sem isto o seek recomeça do zero.
      'Accept-Ranges': 'bytes',
    });

    const byteRange = parseByteRange(range, size);
    if (byteRange === 'unsatisfiable') {
      res.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
      res.set('Content-Range', `bytes */${size}`);
      return;
    }
    if (!byteRange) {
      res.set('Content-Length', String(size));
      return new StreamableFile(media.data);
    }

    const { start, end } = byteRange;
    res.status(HttpStatus.PARTIAL_CONTENT);
    res.set({
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
    });
    return new StreamableFile(media.data.subarray(start, end + 1));
  }

  @UseGuards(FeatureFlagGuard)
  @RequireFeature(MessagingFeatureFlag.CONTACTS)
  @GetApi({
    path: 'contacts',
    summary: 'Lista contatos ordenados pela mensagem mais recente',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_READ,
    queries: [
      { name: 'page', required: false, type: Number },
      { name: 'limit', required: false, type: Number },
      { name: 'connectionId', required: false, type: String },
      { name: 'search', required: false, type: String },
    ],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Contatos, da atividade mais recente para a mais antiga',
          schema: {
            dto: MessagingContactDto,
            isArray: true,
            isPagination: true,
          },
        },
      ],
    },
  })
  async listContactsHandler(
    @Query(new ZodValidationPipe(ListContactsQuerySchema))
    query: ListContactsQuery,
  ) {
    return this.listContacts.execute(query);
  }

  @UseGuards(FeatureFlagGuard)
  @RequireFeature(MessagingFeatureFlag.CONTACTS)
  @PostApi({
    path: 'contacts',
    summary: 'Cria um contato pelo telefone, sem depender de troca de mensagem',
    status: 'CREATED',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
    body: CreateMessagingContactDto,
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Contato criado',
          schema: { dto: MessagingContactDto },
        },
      ],
    },
  })
  async createContactHandler(@Body() dto: CreateMessagingContactDto) {
    return this.createContact.execute(dto);
  }

  @UseGuards(FeatureFlagGuard)
  @RequireFeature(MessagingFeatureFlag.CONTACTS)
  @GetApi({
    path: 'conversations',
    summary: 'Threads de um telefone, para o seletor de conversa',
    description:
      'Uma linha por conexão onde já existe conversa com este telefone, da mais recente para a ' +
      'mais antiga. Vazio quando o telefone ainda não é contato — aí o seletor escolhe entre as ' +
      'conexões vivas.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_READ,
    queries: [{ name: 'phone', required: true, type: String }],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Threads existentes, mais recente primeiro',
          schema: { dto: MessagingConversationSummaryDto, isArray: true },
        },
      ],
    },
  })
  async conversationsHandler(
    @Query(new ZodValidationPipe(ListConversationsQuerySchema))
    { phone }: ListConversationsQuery,
  ) {
    return this.listConversations.execute(phone);
  }

  @UseGuards(FeatureFlagGuard)
  @RequireFeature(MessagingFeatureFlag.CONTACTS)
  @GetApi({
    path: 'contacts/:id/photo',
    summary: 'Foto de perfil do contato, direto do WhatsApp',
    description:
      'A foto não é guardada: a URL do WhatsApp expira, então cada chamada busca (e renova a URL se preciso). 404 quando o contato não tem foto.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_READ,
  })
  async contactPhoto(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const photo = await this.getContactPhoto.execute(id);
    res.set({
      'Content-Type': photo.mimeType,
      'Content-Length': String(photo.data.length),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': 'sandbox',
      'Cache-Control': 'private, max-age=3600',
    });
    return new StreamableFile(photo.data);
  }

  // Stream de longa duração: cada reconexão do cliente não deve gastar o limite global (100/min)
  // que as consultas da própria tela dividem. A autenticação e a duração máxima já o limitam.
  @SkipThrottle()
  @UseGuards(FeatureFlagGuard)
  @RequireFeature(MessagingFeatureFlag.ROOT)
  @GetApi({
    path: 'events',
    summary: 'Mudanças de mensageria em tempo real (SSE)',
    description:
      'Cada evento diz só O QUE mudou (`connection`, `messages`, `contacts`); o cliente refaz a consulta correspondente. Substitui polling.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_READ,
  })
  events(@Req() req: Request, @Res() res: Response): void {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Evita que nginx acumule o stream em buffer e o evento chegue minutos depois.
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    const detach = this.realtime.attach(
      (chunk) => res.write(chunk),
      () => res.end(),
    );
    req.on('close', detach);
  }

  @UseGuards(FeatureFlagGuard)
  @RequireFeature(MessagingFeatureFlag.CONTACTS)
  @PatchApi({
    path: 'contacts/:id',
    summary: 'Atualiza o nome ou o opt-out de um contato',
    description:
      'O opt-out vale para o número em todas as conexões; o nome, só para este contato.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
    body: UpdateMessagingContactDto,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Contato atualizado',
          schema: { dto: MessagingContactDto },
        },
      ],
    },
  })
  async updateContactHandler(
    @Param('id') id: string,
    @Body() dto: UpdateMessagingContactDto,
  ) {
    return this.updateContact.execute(id, dto);
  }

  @GetApi({
    path: 'connections',
    summary: 'Lista as conexões de mensageria',
    description:
      'Cada conexão é um número de WhatsApp acessado por um provider. Segredos não saem: só se estão preenchidos.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_READ,
    queries: [{ name: 'archived', required: false, type: Boolean }],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Conexões, da mais antiga para a mais nova',
          schema: { dto: MessagingConnectionDto, isArray: true },
        },
      ],
    },
  })
  async connections(@Query('archived') archived?: string) {
    return this.listConnections.execute({ archived: archived === 'true' });
  }

  @PostApi({
    path: 'connections/:id/restore',
    summary: 'Restaura uma conexão arquivada',
    description:
      'Reativa uma conexão arquivada mantendo o histórico de mensagens e conversas. Valida se o número confere (Meta) ou se vincula ao mesmo número no pareamento (Evolution).',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
    body: SaveMessagingConnectionDto,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Conexão restaurada e resultado do registro do webhook',
          schema: { dto: SaveMessagingConnectionResponseDto },
        },
      ],
    },
  })
  async restoreConnectionHandler(
    @Param('id') id: string,
    @Body() dto: SaveMessagingConnectionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.restoreConnection.execute(id, dto, currentUser.id);
  }

  @PostApi({
    path: 'connections',
    summary: 'Cria a conexão de um provider',
    description:
      'Valida as credenciais no provider e só então grava. Cada provider tem no máximo uma conexão. Na Evolution API a instância (UUID) é criada no provider.',
    status: 'CREATED',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
    body: SaveMessagingConnectionDto,
    response: {
      success: [
        {
          status: 'CREATED',
          description: 'Conexão criada e resultado do registro do webhook',
          schema: { dto: SaveMessagingConnectionResponseDto },
        },
      ],
    },
  })
  async createConnectionHandler(
    @Body() dto: SaveMessagingConnectionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.createConnection.execute(dto, currentUser.id);
  }

  @PutApi({
    path: 'connections/:id/default',
    summary: 'Define a conexão padrão',
    description:
      'A conexão padrão envia quando quem chama (outro módulo, tool de IA) não informa a conexão. Só uma é padrão: a anterior deixa de ser.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Conexão agora padrão',
          schema: { dto: MessagingConnectionDto },
        },
      ],
    },
  })
  async setDefaultHandler(@Param('id') id: string) {
    return this.setDefaultConnection.execute(id);
  }

  @PutApi({
    path: 'connections/:id',
    summary: 'Edita as credenciais de uma conexão',
    description:
      'Credenciais que acessem outro número que o da conexão são recusadas. Segredo em branco mantém o gravado.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
    body: SaveMessagingConnectionDto,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Conexão atualizada e resultado do registro do webhook',
          schema: { dto: SaveMessagingConnectionResponseDto },
        },
      ],
    },
  })
  async updateConnectionHandler(
    @Param('id') id: string,
    @Body() dto: SaveMessagingConnectionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.updateConnection.execute(id, dto, currentUser.id);
  }

  @DeleteApi({
    path: 'connections/:id',
    summary: 'Arquiva uma conexão',
    description:
      'Tira a conexão de uso e libera o número, mantendo o histórico legível. É como se troca de provider ou de número, já que ambos são imutáveis numa conexão em uso. Arquivar a padrão promove outra.',
    status: 'OK',
    roles: ['ADMIN'],
    scope: McpScopes.MESSAGING_WRITE,
    response: {
      success: [
        {
          status: 'OK',
          description: 'Conexão arquivada',
          schema: { dto: MessagingConnectionDto },
        },
      ],
    },
  })
  async archiveConnectionHandler(@Param('id') id: string) {
    return this.archiveConnection.execute(id);
  }

  @UseGuards(FeatureFlagGuard)
  @RequireFeature(MessagingFeatureFlag.CHAT)
  @GetApi({
    path: 'connections/:id/capabilities',
    summary: 'Tipos de mensagem suportados pelo provider da conexão',
    status: 'OK',
    roles: ['ADMIN'],
    response: {
      success: [
        {
          status: 'OK',
          description: 'Recursos do provider da conexão',
          schema: { dto: MessagingCapabilitiesDto },
        },
      ],
    },
  })
  async capabilities(@Param('id') id: string) {
    return this.getCapabilitiesUseCase.execute(id);
  }

  @GetApi({
    path: 'connections/:id/health',
    summary: 'Saúde da conexão (via cache)',
    description:
      'Credencial válida e, nos providers com QR, sessão conectada. O cache cai quando o webhook avisa uma mudança.',
    status: 'OK',
    roles: ['ADMIN'],
  })
  async health(
    @Param('id') id: string,
  ): Promise<{ operational: boolean; reason?: string }> {
    return this.checkHealth.execute(id);
  }

  @PostApi({
    path: 'connections/:id/session',
    summary: 'Conecta a sessão do WhatsApp (cria a instância e devolve o QR)',
    status: 'OK',
    roles: ['ADMIN'],
  })
  async connectSession(@Param('id') id: string) {
    return this.session.connect(id);
  }

  @GetApi({
    path: 'connections/:id/session',
    summary: 'Estado da sessão do WhatsApp da conexão',
    status: 'OK',
    roles: ['ADMIN'],
  })
  async sessionStatus(@Param('id') id: string) {
    return this.session.status(id);
  }

  @DeleteApi({
    path: 'connections/:id/session',
    summary: 'Desconecta a sessão do WhatsApp',
    description:
      'A conexão e o número ficam; reconectar só funciona com o mesmo número.',
    status: 'OK',
    roles: ['ADMIN'],
  })
  async disconnectSession(@Param('id') id: string): Promise<ProviderResult> {
    const result = await this.session.disconnect(id);
    if (result) assertProviderOk(result);
    return result;
  }

  @Throttle({ default: { ttl: 60000, limit: WEBHOOK_RATE_LIMIT } })
  @GetApi({
    path: 'webhook',
    summary: 'Handshake de verificação do webhook (Meta)',
    status: 'OK',
    authenticated: false,
    queries: [
      { name: 'hub.mode', required: false, type: String },
      { name: 'hub.verify_token', required: false, type: String },
      { name: 'hub.challenge', required: false, type: String },
      { name: 'key', required: false, type: String },
    ],
  })
  async webhookChallenge(@Query() query: Record<string, string>) {
    const challenge = await this.verifyChallenge.execute(query);
    if (challenge === null) throw new ForbiddenException();
    return challenge;
  }

  @Throttle({ default: { ttl: 60000, limit: WEBHOOK_RATE_LIMIT } })
  @PostApi({
    path: 'webhook',
    summary: 'Recebe eventos do provider de mensageria',
    status: 'OK',
    authenticated: false,
    queries: [{ name: 'key', required: false, type: String }],
  })
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Query() query: Record<string, string>,
  ): Promise<{ accepted: boolean }> {
    return this.receiveWebhook.execute({
      raw: req.rawBody ?? Buffer.alloc(0),
      headers: req.headers as Record<string, string | undefined>,
      query,
    });
  }
}
