import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { setTimeout as sleep } from 'timers/promises';
import type { MessagingConnection } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { FeatureFlagService } from 'src/modules/feature-flag/feature-flag.service';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import type {
  DownloadedMedia,
  IMessagingProvider,
  MessagingEvent,
  MessagingPresenceState,
  SendMessageInput,
  SendResult,
} from 'src/domain/interface/messaging-provider.interface';
import {
  MessagingDirectionConst,
  MessagingFeatureFlag,
  MessagingStatusConst,
  furthestStatus,
  isMediaType,
  statusesBefore,
  type MessagingProvider,
} from 'src/domain/messaging/messaging.const';
import type { MessageCorrelation } from 'src/domain/messaging/messaging-buttons.const';
import { maskPhone, normalizePhone } from './providers/phone.util';
import {
  ProviderTimeoutError,
  isTransientProviderError,
} from './providers/provider-http.util';
import { MessagingNonRetryableError } from './messaging.errors';
import {
  MESSAGING_PENDING_WINDOW_MS,
  MESSAGING_SEND_QUEUES,
  sendJobOptions,
  sendPartition,
} from './messaging-queue.const';
import { MediaCache } from './providers/media-cache.util';
import { MessagingButtonEventService } from './messaging-button-events.service';
import { ContactProfileSyncService } from './contact-profile-sync.service';
import { MessagingEventsService } from './messaging-events.service';
import { MessagingConnectionService } from './messaging-connection.service';
import { MessagingWebhookService } from './messaging-webhook.service';
import { MessagingConnectionStateService } from './messaging-connection-state.service';
import { MessagingProviderRegistry } from './messaging-provider.registry';
import {
  MessagingTemplateService,
  type ResolveTemplateInput,
} from './messaging-template.service';
import { unreachableMediaReason } from './providers/media-url.util';
import { categoryChangeData } from './providers/template.util';

export interface MessagingCandidateConfig {
  provider: MessagingProvider;
  config: unknown;
}

export interface SendOptions {
  userId?: string | null;
  /** Conexão que envia. Omitido = a conexão padrão (ver `MessagingConnectionService.resolve`). */
  connectionId?: string | null;
  /** Avisos de segurança (ex.: troca de senha) furam o opt-out — é permissão, não rótulo do template. */
  bypassOptOut?: boolean;
  /** Template de origem: precheck de aprovação e elo que liga o toque do botão ao handler. */
  templateId?: string;
  /** Referência de negócio gravada na mensagem e devolvida ao handler do botão quando o cliente responde. */
  correlation?: MessageCorrelation;
}

export interface DispatchOptions {
  /** O envio foi aceito com permissão para furar o opt-out (aviso de segurança): o recheck do dispatch o respeita. */
  bypassOptOut?: boolean;
  /** Quantas tentativas o chamador ainda fará depois desta; sem mais tentativa o status vira FAILED. */
  retriesLeft?: number;
}

/** Quantas vezes gravar o resultado de um envio que o provider JÁ aceitou, antes de desistir. */
const PERSIST_ACCEPTED_ATTEMPTS = 3;
const PERSIST_ACCEPTED_RETRY_MS = 250;

/** `raw` é gravado no banco: o arquivo enviado e qualquer `base64` embutido pelo provider ficam de fora. */
function storableRaw(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(storableRaw);
  if (!value || typeof value !== 'object' || Buffer.isBuffer(value))
    return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'base64' && key !== 'file')
      .map(([key, child]) => [key, storableRaw(child)]),
  );
}

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private readonly mediaCache = new MediaCache<DownloadedMedia>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlags: FeatureFlagService,
    private readonly connections: MessagingConnectionService,
    private readonly registry: MessagingProviderRegistry,
    private readonly state: MessagingConnectionStateService,
    private readonly events: MessagingEventsService,
    private readonly i18n: I18nService,
    private readonly templates: MessagingTemplateService,
    private readonly profiles: ContactProfileSyncService,
    private readonly webhooks: MessagingWebhookService,
    /** Filas de envio, na ordem das partições; ausente (sem Redis) = envio síncrono. */
    @Optional()
    @Inject(MESSAGING_SEND_QUEUES)
    private readonly queues: Queue[] | null,
    @Optional()
    private readonly buttonEvents: MessagingButtonEventService | null = null,
  ) {}

  /** Enfileira o envio na partição da conversa; arquivo anexado envia já, fora da fila. */
  async send(
    input: SendMessageInput,
    options: SendOptions = {},
  ): Promise<string> {
    const hasFile = 'file' in input && !!input.file;
    const inline = hasFile || !this.queues;
    const { id, connectionId, contactId } = await this.createQueued(
      input,
      options,
      inline,
    );

    // Linha redigida (variável sensitive) não tem o texto real: o conteúdo viaja no job, não no banco.
    const redacted = this.isRedacted(input);
    if (hasFile || !this.queues) {
      if (!hasFile) {
        this.logger.warn(
          'Filas de envio indisponíveis: enviando de forma síncrona',
        );
      }
      await this.dispatch(id, hasFile || redacted ? input : undefined, {
        bypassOptOut: options.bypassOptOut,
      });
      return id;
    }
    await this.queues[sendPartition(connectionId, contactId)].add(
      'send',
      {
        messageId: id,
        ...(redacted ? { input } : {}),
        ...(options.bypassOptOut ? { bypassOptOut: true } : {}),
      },
      // O job de quem falhou ainda carrega o valor real (redigido): some em 1h em vez de ficar.
      sendJobOptions(id, redacted),
    );
    return id;
  }

  /** Envia um template do catálogo resolvendo variáveis, respeitando bypassOptOut e o precheck de aprovação. */
  async sendTemplate(
    input: ResolveTemplateInput,
    options: SendOptions = {},
  ): Promise<string> {
    const { resolved, bypassOptOut, templateId } =
      await this.templates.resolve(input);
    return this.send(
      { type: 'TEMPLATE', phone: input.phone, template: resolved },
      {
        ...options,
        bypassOptOut: options.bypassOptOut ?? bypassOptOut,
        templateId,
      },
    );
  }

  /** `sendTemplate()` para quem a mensagem é um extra: devolve `null` em vez de lançar. */
  async trySendTemplate(
    input: ResolveTemplateInput,
    options: SendOptions = {},
  ): Promise<string | null> {
    try {
      return await this.sendTemplate(input, options);
    } catch (error) {
      this.logger.warn(
        `Template para ${maskPhone(input.phone)} não enviado: ${String((error as Error)?.message ?? error)}`,
      );
      return null;
    }
  }

  /** `sendTemplate` síncrono: resolve o template e envia inline (sem fila), aguardando o resultado do provider. */
  async sendTemplateNow(
    input: ResolveTemplateInput,
    options: SendOptions = {},
  ): Promise<SendResult> {
    const { resolved, bypassOptOut, templateId } =
      await this.templates.resolve(input);
    return this.sendNow(
      { type: 'TEMPLATE', phone: input.phone, template: resolved },
      {
        ...options,
        bypassOptOut: options.bypassOptOut ?? bypassOptOut,
        templateId,
      },
    );
  }

  /** `sendTemplateNow` para quem a mensagem é um extra: devolve `null` em vez de lançar. */
  async trySendTemplateNow(
    input: ResolveTemplateInput,
    options: SendOptions = {},
  ): Promise<SendResult | null> {
    try {
      return await this.sendTemplateNow(input, options);
    } catch (error) {
      this.logger.warn(
        `Template para ${maskPhone(input.phone)} não enviado: ${String((error as Error)?.message ?? error)}`,
      );
      return null;
    }
  }

  private isRedacted(input: SendMessageInput): boolean {
    return input.type === 'TEMPLATE' && !!input.template.redacted;
  }

  /** O que vai para o banco: igual ao input, exceto o template com valores sensitive mascarados. */
  private storable(input: SendMessageInput): SendMessageInput {
    if (input.type !== 'TEMPLATE' || !input.template.redacted) return input;
    const { redacted, ...template } = input.template;
    return {
      ...input,
      template: {
        ...template,
        body: redacted.body,
        values: redacted.values,
        // Só os nomes: o dispatch reconhece a linha redigida e não a sobrescreve com o eco do provider.
        sensitive: redacted.names,
      } as typeof template,
    };
  }

  async sendNow(
    input: SendMessageInput,
    options: SendOptions = {},
  ): Promise<SendResult> {
    const { id } = await this.createQueued(input, options, true);
    return this.dispatch(id, input, { bypassOptOut: options.bypassOptOut });
  }

  /** Avisa o provider que o operador está digitando, sem esperar resposta; falha é só não notificar. */
  async sendPresence(
    phone: string,
    state: MessagingPresenceState,
    options: SendOptions = {},
  ): Promise<void> {
    const connection = await this.connections.resolve(options.connectionId);
    const provider = this.connections.use(connection);
    if (!provider.sendPresence) return;
    void provider
      .sendPresence(normalizePhone(phone), state)
      .catch((error) =>
        this.logger.warn(
          `Presença para ${maskPhone(phone)} não enviada: ${String((error as Error)?.message ?? error)}`,
        ),
      );
  }

  /** `send()` para quem a mensagem é um extra: devolve `null` em vez de lançar, sem mensageria pronta. */
  async trySend(
    input: SendMessageInput,
    options: SendOptions = {},
  ): Promise<string | null> {
    try {
      return await this.send(input, options);
    } catch (error) {
      this.logger.warn(
        `Mensagem para ${maskPhone(input.phone)} não enviada: ${String((error as Error)?.message ?? error)}`,
      );
      return null;
    }
  }

  /** Idempotente: input só é passado quando carrega bytes que não estão no banco; a fila pode reentregar o job. */
  async dispatch(
    messageId: string,
    input?: SendMessageInput,
    options: DispatchOptions = {},
  ): Promise<SendResult> {
    const row = await this.prisma.messagingMessage.findUnique({
      where: { id: messageId },
      include: { contact: { select: { phone: true, optOut: true } } },
    });
    if (!row) {
      throw new NotFoundException(this.i18n.t('messaging.message_not_found'));
    }

    // O provider já aceitou esta mensagem: reenviar a duplicaria.
    if (row.providerMessageId) {
      return {
        providerMessageId: row.providerMessageId,
        acceptedAt: row.updatedAt,
      };
    }

    // Opt-out pedido depois de enfileirar (entre tentativas passam minutos). Resultado não muda: sem retry.
    if (row.contact.optOut && !options.bypassOptOut) {
      const message = this.i18n.t('messaging.opt_out');
      await this.recordSendFailure(messageId, message, false);
      throw new MessagingNonRetryableError(message);
    }

    let result: SendResult;
    try {
      // Sem o `input` real não há como reenviar: mandar a linha mascarada entregaria "••••••" ao contato.
      if (!input && this.rawIsRedacted(row.raw)) {
        throw new Error(
          'mensagem com variável sensível não pode ser reenviada sem o conteúdo original',
        );
      }
      const provider = await this.providerFor(row.connectionId);
      result = await provider.send(input ?? this.toSendInput(row));
    } catch (error) {
      // Sem resposta a tempo o resultado é ambíguo: o provider pode ter enviado. Repetir duplicaria.
      if (error instanceof ProviderTimeoutError) {
        const message = this.i18n.t('messaging.send_timeout');
        await this.recordSendFailure(messageId, message, false);
        throw new MessagingNonRetryableError(message, { cause: error });
      }
      await this.recordSendFailure(
        messageId,
        String((error as Error)?.message ?? error),
        (options.retriesLeft ?? 0) > 0 && isTransientProviderError(error),
      );
      throw error;
    }

    await this.persistAccepted(row, result);
    this.events.emit({ type: 'messages' });
    return result;
  }

  /** Recusa envio direto se a conversa já tem mensagem saindo, ignorando QUEUED órfã antiga. */
  private async assertConversationIdle(
    connectionId: string,
    contactId: string,
  ): Promise<void> {
    const pending = await this.prisma.messagingMessage.findFirst({
      where: {
        connectionId,
        contactId,
        direction: MessagingDirectionConst.OUTBOUND,
        status: MessagingStatusConst.QUEUED,
        providerMessageId: null,
        createdAt: { gt: new Date(Date.now() - MESSAGING_PENDING_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException(this.i18n.t('messaging.conversation_busy'));
    }
  }

  /** Falha de envio: com nova tentativa agendada o status segue `QUEUED` (só `error` muda); sem ela, `FAILED`. */
  private async recordSendFailure(
    messageId: string,
    message: string,
    willRetry: boolean,
  ): Promise<void> {
    this.logger.warn(
      `Envio ${messageId} falhou${willRetry ? ' (nova tentativa agendada)' : ''}: ${message}`,
    );
    await this.prisma.messagingMessage.update({
      where: { id: messageId },
      data: {
        error: message,
        ...(willRetry ? {} : { status: MessagingStatusConst.FAILED }),
      },
    });
    this.events.emit({ type: 'messages' });
  }

  /** Grava o que o provider devolveu, tentando de novo em queda curta; esgotado, erro sem retry para conciliação manual. */
  private async persistAccepted(
    row: { id: string; connectionId: string; raw: unknown },
    result: SendResult,
  ): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await this.markSent(row.connectionId, row.id, row.raw, result);
        return;
      } catch (error) {
        const reason = String((error as Error)?.message ?? error);
        if (attempt < PERSIST_ACCEPTED_ATTEMPTS) {
          await sleep(PERSIST_ACCEPTED_RETRY_MS * attempt);
          continue;
        }
        this.logger.error(
          `Mensagem ${row.id} ACEITA pelo provider (${result.providerMessageId}) mas não registrada: ${reason}`,
        );
        const message = `aceita pelo provider (${result.providerMessageId}), mas o registro falhou: ${reason}`;
        await this.prisma.messagingMessage
          .update({ where: { id: row.id }, data: { error: message } })
          .catch(() => undefined);
        throw new MessagingNonRetryableError(message, { cause: error });
      }
    }
  }

  private rawIsRedacted(raw: unknown): boolean {
    const names = (raw as { template?: { sensitive?: unknown } } | null)
      ?.template?.sensitive;
    return Array.isArray(names) && names.length > 0;
  }

  /** Descarta a linha do eco chegado antes do id, aproveitando o `raw` dela (a mídia canônica) antes de apagar. */
  private async markSent(
    connectionId: string,
    messageId: string,
    raw: unknown,
    result: SendResult,
  ): Promise<void> {
    // Linha redigida (sensitive): o eco do provider traz o texto real, então o `raw` mascarado fica.
    const keepRaw = this.rawIsRedacted(raw);
    await this.prisma.$transaction(async (tx) => {
      const echoWhere = {
        connectionId,
        providerMessageId: result.providerMessageId,
        id: { not: messageId },
      };
      const [echo] = await tx.messagingMessage.findMany({
        where: echoWhere,
        select: { raw: true, status: true },
      });
      await tx.messagingMessage.deleteMany({ where: echoWhere });
      await tx.messagingMessage.update({
        where: { id: messageId },
        data: {
          // O eco pode já ter avançado (DELIVERED/READ) antes de a linha dele ser descartada.
          status: echo
            ? furthestStatus(MessagingStatusConst.SENT, echo.status)
            : MessagingStatusConst.SENT,
          providerMessageId: result.providerMessageId,
          error: null,
          ...(echo && !keepRaw
            ? { raw: echo.raw as never }
            : result.mediaRef
              ? { raw: { ...(raw as object), mediaRef: result.mediaRef } }
              : {}),
        },
      });
    });
  }

  private async createQueued(
    input: SendMessageInput,
    options: SendOptions,
    inline: boolean,
  ): Promise<{ id: string; connectionId: string; contactId: string }> {
    if (!(await this.isEnabled())) {
      throw new ServiceUnavailableException(this.i18n.t('messaging.disabled'));
    }

    const phone = normalizePhone(input.phone);
    if (!phone) {
      throw new BadRequestException(this.i18n.t('messaging.phone_required'));
    }

    const connection = await this.connections.resolve(options.connectionId);
    // Opt-out é do contato (global): leitura direta, sem contato ainda é ninguém pediu para parar.
    const existing = await this.prisma.messagingContact.findUnique({
      where: { phone },
      select: { optOut: true },
    });
    if (existing?.optOut && !options.bypassOptOut) {
      throw new BadRequestException(this.i18n.t('messaging.opt_out'));
    }

    if (input.type === 'TEMPLATE') {
      await this.assertTemplateApproved(connection, options.templateId);
    } else {
      await this.assertInsideServiceWindow(connection, phone);
    }

    const mediaUrl = 'mediaUrl' in input ? input.mediaUrl : undefined;
    const file = 'file' in input ? input.file : undefined;
    if (input.type !== 'TEXT' && input.type !== 'TEMPLATE') {
      // Exatamente uma origem: link que o provider baixa, ou o arquivo que nós repassamos.
      if (!mediaUrl === !file) {
        throw new BadRequestException(this.i18n.t('messaging.media_source'));
      }
    }
    if (mediaUrl) {
      const reason = unreachableMediaReason(mediaUrl);
      if (reason) throw new BadRequestException(reason);
    }

    const contactId = await this.upsertContact(connection.id, phone);
    if (inline) await this.assertConversationIdle(connection.id, contactId);

    const row = await this.prisma.messagingMessage.create({
      data: {
        connectionId: connection.id,
        contactId,
        direction: MessagingDirectionConst.OUTBOUND,
        status: MessagingStatusConst.QUEUED,
        type: input.type,
        text: this.textOf(this.storable(input)),
        mediaUrl: mediaUrl ?? null,
        mimeType: file?.mimeType ?? null,
        fileName: 'fileName' in input ? input.fileName : null,
        raw: storableRaw(this.storable(input)) as never,
        sentById: options.userId ?? null,
        templateId:
          input.type === 'TEMPLATE' ? (options.templateId ?? null) : null,
        correlation: (options.correlation ?? undefined) as never,
      },
      select: { id: true },
    });
    this.afterConversationChange(contactId);
    return { id: row.id, connectionId: connection.id, contactId };
  }

  /** Barra mensagem livre fora da janela de atendimento do provider antes de gravar, evitando 5 tentativas na fila. */
  private async assertInsideServiceWindow(
    connection: MessagingConnection,
    phone: string,
  ): Promise<void> {
    const hours = this.connections
      .use(connection)
      .capabilities().serviceWindowHours;
    if (!hours) return;
    const conversation = await this.prisma.messagingConversation.findFirst({
      where: { connectionId: connection.id, contact: { phone } },
      select: { lastInboundAt: true },
    });
    const last = conversation?.lastInboundAt?.getTime();
    if (last === undefined || Date.now() - last > hours * 3_600_000) {
      throw new BadRequestException(
        this.i18n.t('messaging.outside_service_window', { args: { hours } }),
      );
    }
  }

  /** Falha na hora se o template não está aprovado, antes de qualquer escrita. */
  private async assertTemplateApproved(
    connection: MessagingConnection,
    templateId: string | undefined,
  ): Promise<void> {
    const provider = this.connections.use(connection);
    if (!provider.capabilities().template.approval) return;

    const submission = templateId
      ? await this.prisma.messagingTemplateSubmission.findUnique({
          where: {
            templateId_connectionId: {
              templateId,
              connectionId: connection.id,
            },
          },
        })
      : null;
    if (submission?.status !== 'APPROVED') {
      throw new BadRequestException(
        this.i18n.t('messaging.template_not_approved', {
          args: {
            status:
              submission?.status ??
              this.i18n.t('messaging.template_not_submitted'),
          },
        }),
      );
    }
  }

  /** Upsert do contato (global, por telefone) e da conversa (por conexão+contato); devolve o contactId. */
  private async upsertContact(
    connectionId: string,
    phone: string,
    pushName?: string,
    inbound = false,
  ): Promise<string> {
    const now = new Date();
    const contact = await this.prisma.messagingContact.upsert({
      where: { phone },
      create: { phone, lastMessageAt: now, ...(pushName ? { pushName } : {}) },
      update: { lastMessageAt: now, ...(pushName ? { pushName } : {}) },
      select: { id: true },
    });
    await this.prisma.messagingConversation.upsert({
      where: {
        connectionId_contactId: { connectionId, contactId: contact.id },
      },
      create: {
        connectionId,
        contactId: contact.id,
        lastMessageAt: now,
        ...(inbound ? { lastInboundAt: now } : {}),
      },
      update: {
        lastMessageAt: now,
        ...(inbound ? { lastInboundAt: now } : {}),
      },
    });
    return contact.id;
  }

  /** Relé direto do webhook, sem fila nem banco: presença é efêmera, perder uma notificação não importa. */
  emitPresence(
    connectionId: string,
    event: Extract<MessagingEvent, { kind: 'PRESENCE' }>,
  ): void {
    this.events.emit({
      type: 'presence',
      connectionId,
      phone: event.phone,
      state: event.state,
    });
  }

  /** Descarta o que vier de número na ignore list. Evento sem telefone (STATUS, CONNECTION) passa. */
  async dropIgnored(events: MessagingEvent[]): Promise<MessagingEvent[]> {
    const ignored = await this.webhooks.ignoredPhones();
    if (ignored.size === 0) return events;
    return events.filter((event) => {
      const phone = 'phone' in event ? event.phone : undefined;
      return !phone || !ignored.has(normalizePhone(phone));
    });
  }

  /** Processa o que o provider mandou para UMA conexão — tudo escopado por ela. */
  async ingest(
    connectionId: string,
    body: unknown,
  ): Promise<{ messages: number; statuses: number; connections: number }> {
    const connection = await this.connections.getActive(connectionId);
    const parsed = this.connections.use(connection).parseWebhook(body);
    const events = await this.dropIgnored(parsed);
    const counts = { messages: 0, statuses: 0, connections: 0 };
    const orphanStatuses: string[] = [];

    for (const event of events) {
      switch (event.kind) {
        case 'STATUS':
          if (await this.applyStatus(connection.id, event)) {
            counts.statuses += 1;
          } else {
            orphanStatuses.push(event.providerMessageId);
          }
          break;
        case 'CONNECTION':
          await this.state.applyEvent(connection, event);
          counts.connections += 1;
          break;
        case 'CONTACT':
          await this.applyContact(event);
          break;
        case 'PRESENCE':
          // ReceiveWebhookUseCase desvia presença antes da fila; chegar aqui é só type-safety.
          break;
        case 'TEMPLATE_STATUS':
          await this.applyTemplateStatus(event);
          break;
        case 'TEMPLATE_CATEGORY':
          await this.applyTemplateCategory(event);
          break;
        default:
          // Sem telefone não há contato a quem atribuir: gravar criaria um contato vazio.
          if (!event.phone) break;
          await this.saveIncoming(connection.id, event);
          counts.messages += 1;
      }
    }

    // Status órfão lança no fim do lote, não no meio.
    if (orphanStatuses.length > 0) {
      throw new Error(
        `Status para mensagem desconhecida ${orphanStatuses.join(', ')}`,
      );
    }
    return counts;
  }

  /** Nome/foto empurrados pelo provider; só atualiza contato que já existe, global por telefone. */
  private async applyContact(
    event: Extract<MessagingEvent, { kind: 'CONTACT' }>,
  ): Promise<void> {
    const { count } = await this.prisma.messagingContact.updateMany({
      where: { phone: event.phone },
      data: {
        ...(event.pushName ? { pushName: event.pushName } : {}),
        ...(event.profilePictureUrl
          ? { profilePictureUrl: event.profilePictureUrl }
          : {}),
      },
    });
    if (count > 0) this.events.emit({ type: 'contacts' });
  }

  /** Casa pelo `providerTemplateId`, não pela conexão: órfão aqui só avisa, nunca aborta o lote. */
  private async applyTemplateStatus(
    event: Extract<MessagingEvent, { kind: 'TEMPLATE_STATUS' }>,
  ): Promise<void> {
    const { count } = await this.prisma.messagingTemplateSubmission.updateMany({
      where: { providerTemplateId: event.providerTemplateId },
      data: {
        status: event.status,
        reason: event.reason ?? null,
        reviewedAt: new Date(),
      },
    });
    if (count > 0) this.events.emit({ type: 'templates' });
    if (count === 0) {
      this.logger.warn(
        `Status de template ${event.name} (${event.providerTemplateId}) sem submissão correspondente`,
      );
    }
  }

  /** A Meta reclassificou o template: o sistema acompanha a decisão e guarda a anterior para avisar. */
  private async applyTemplateCategory(
    event: Extract<MessagingEvent, { kind: 'TEMPLATE_CATEGORY' }>,
  ): Promise<void> {
    const submission = await this.prisma.messagingTemplateSubmission.findFirst({
      where: { providerTemplateId: event.providerTemplateId },
      include: { template: true },
    });
    const change = submission
      ? categoryChangeData(submission.template.category, event.newCategory)
      : null;
    if (!submission || !change) return;
    await this.prisma.messagingTemplate.update({
      where: { id: submission.templateId },
      data: change,
    });
    this.events.emit({ type: 'templates' });
  }

  /** false = nenhuma mensagem casou (status órfão); evento atrasado casa mas não rebaixa o status. */
  private async applyStatus(
    connectionId: string,
    event: Extract<MessagingEvent, { kind: 'STATUS' }>,
  ): Promise<boolean> {
    const where = { connectionId, providerMessageId: event.providerMessageId };
    const { count } = await this.prisma.messagingMessage.updateMany({
      where: { ...where, status: { in: statusesBefore(event.status) } },
      data: { status: event.status },
    });
    if (count > 0) {
      this.events.emit({ type: 'messages' });
      return true;
    }
    return (await this.prisma.messagingMessage.count({ where })) > 0;
  }

  /** Grava mensagem vinda do provider; `fromMe` entra como OUTBOUND, como no WhatsApp Web. */
  private async saveIncoming(
    connectionId: string,
    event: Extract<MessagingEvent, { kind: 'MESSAGE' }>,
  ): Promise<void> {
    const contactId = await this.upsertContact(
      connectionId,
      event.phone,
      event.pushName,
      !event.fromMe,
    );
    const row = await this.prisma.messagingMessage.upsert({
      where: {
        connectionId_providerMessageId: {
          connectionId,
          providerMessageId: event.providerMessageId,
        },
      },
      create: {
        connectionId,
        contactId,
        direction: event.fromMe
          ? MessagingDirectionConst.OUTBOUND
          : MessagingDirectionConst.INBOUND,
        status: event.fromMe
          ? MessagingStatusConst.SENT
          : MessagingStatusConst.DELIVERED,
        providerMessageId: event.providerMessageId,
        replyToProviderMessageId: event.replyTo ?? null,
        type: event.type,
        text: event.text ?? null,
        mimeType: event.mimeType ?? null,
        fileName: event.fileName ?? null,
        raw: storableRaw(event.raw) as never,
        createdAt: event.at,
      },
      // Linha já existe e o evento é nosso: grava o raw do eco, a fonte canônica da mídia.
      update: event.fromMe ? { raw: storableRaw(event.raw) as never } : {},
      select: { id: true },
    });
    // Toque do cliente num botão com chave: vira evento (idempotente) e segue para a fila de handlers.
    if (this.buttonEvents && !event.fromMe && event.buttonPayload && row?.id) {
      await this.buttonEvents.capture({
        connectionId,
        messageId: row.id,
        contactId,
        replyTo: event.replyTo,
        payload: event.buttonPayload,
      });
    }
    this.afterConversationChange(contactId);
  }

  /** Baixa a mídia direto do provider a cada pedido; nada fica guardado aqui. */
  async downloadMedia(messageId: string): Promise<DownloadedMedia> {
    const row = await this.prisma.messagingMessage.findUnique({
      where: { id: messageId },
    });
    if (!row) {
      throw new NotFoundException(this.i18n.t('messaging.message_not_found'));
    }
    if (!isMediaType(row.type) || !row.providerMessageId) {
      throw new NotFoundException(this.i18n.t('messaging.media_not_found'));
    }

    try {
      const media = await this.mediaCache.getOrLoad(messageId, async () =>
        (await this.providerFor(row.connectionId)).downloadMedia({
          providerMessageId: row.providerMessageId!,
          fromMe: row.direction === MessagingDirectionConst.OUTBOUND,
          raw: row.raw,
        }),
      );
      return {
        ...media,
        mimeType:
          media.mimeType === 'application/octet-stream' && row.mimeType
            ? row.mimeType
            : media.mimeType,
        fileName: media.fileName ?? row.fileName ?? undefined,
      };
    } catch (error) {
      this.logger.warn(
        `Mídia ${messageId} indisponível no provider: ${String((error as Error)?.message ?? error)}`,
      );
      throw new NotFoundException(this.i18n.t('messaging.media_not_found'));
    }
  }

  /** Toda mudança numa conversa avisa a tela e sincroniza o perfil do contato em segundo plano. */
  private afterConversationChange(contactId: string): void {
    this.events.emit({ type: 'messages' });
    this.events.emit({ type: 'contacts' });
    this.profiles.syncQuietly(contactId);
  }

  /** Grava o corpo já renderizado — não o nome do template, que não diz nada no histórico. */
  private textOf(input: SendMessageInput): string | null {
    switch (input.type) {
      case 'TEXT':
        return input.text;
      case 'TEMPLATE':
        return input.template.body;
      default:
        return ('caption' in input && input.caption) || null;
    }
  }

  private toSendInput(row: {
    type: string;
    contact: { phone: string };
    text: string | null;
    mediaUrl: string | null;
    raw?: unknown;
  }): SendMessageInput {
    const stored = row.raw as Partial<SendMessageInput> | null | undefined;
    if (stored && typeof stored === 'object' && stored.type === row.type) {
      return { ...stored, phone: row.contact.phone } as SendMessageInput;
    }

    if (row.type === 'TEXT') {
      return { type: 'TEXT', phone: row.contact.phone, text: row.text ?? '' };
    }
    return {
      type: row.type,
      phone: row.contact.phone,
      mediaUrl: row.mediaUrl ?? '',
    } as SendMessageInput;
  }

  async isEnabled(): Promise<boolean> {
    return this.featureFlags.isEnabled(MessagingFeatureFlag.ROOT, '');
  }

  /** Provider da conexão, com a configuração dela já decifrada e validada. */
  async providerFor(connectionId: string): Promise<IMessagingProvider> {
    return this.connections.use(await this.connections.get(connectionId));
  }

  /** Sonda credenciais ainda não gravadas e devolve o número da conta quando o provider o sabe sem QR. */
  async inspectCandidate(
    candidate: MessagingCandidateConfig,
  ): Promise<{ result: ProviderResult; accountPhone: string | null }> {
    const adapter = this.registry.find(candidate.provider);
    if (!adapter) {
      return {
        result: {
          status: false,
          data: `Provider desconhecido: ${String(candidate.provider)}`,
        },
        accountPhone: null,
      };
    }
    try {
      const parsed = adapter.configSchema.safeParse(candidate.config);
      if (!parsed.success) {
        return {
          result: {
            status: false,
            data: parsed.error.issues
              .map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`)
              .join('; '),
          },
          accountPhone: null,
        };
      }
      const provider = adapter.use(parsed.data);
      const result = await provider.validateConfiguration();
      const accountPhone =
        result.status && provider.accountPhone
          ? await provider.accountPhone().catch(() => null)
          : null;
      return { result, accountPhone };
    } catch (error) {
      return {
        result: {
          status: false,
          data: String((error as Error)?.message ?? error),
        },
        accountPhone: null,
      };
    }
  }
}
