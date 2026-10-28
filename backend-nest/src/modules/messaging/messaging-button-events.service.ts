import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  decodeButtonPayload,
  type ButtonEvent,
  type MessageCorrelation,
} from 'src/domain/messaging/messaging-buttons.const';
import { ButtonHandlerRegistry } from './button-handler.registry';
import { MESSAGING_QUEUE, buttonJobOptions } from './messaging-queue.const';

export interface CaptureButtonTap {
  connectionId: string;
  /** Linha da mensagem de ENTRADA (o toque). */
  messageId: string;
  contactId: string;
  /** `context.id`: id (no provider) da mensagem que o cliente respondeu. */
  replyTo?: string;
  payload: string;
}

/** Leva o toque do cliente num botão ao handler, em dois passos: captura do webhook e processamento na fila. */
@Injectable()
export class MessagingButtonEventService {
  private readonly logger = new Logger(MessagingButtonEventService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ButtonHandlerRegistry,
    @Optional()
    @InjectQueue(MESSAGING_QUEUE.BUTTONS)
    private readonly queue: Queue | null,
  ) {}

  async capture(tap: CaptureButtonTap): Promise<void> {
    // Payload que não segue o formato (id de botão de outro sistema) não é nosso: só texto no chat.
    const decoded = decodeButtonPayload(tap.payload);
    if (!decoded) return;

    const original = tap.replyTo
      ? await this.prisma.messagingMessage.findUnique({
          where: {
            connectionId_providerMessageId: {
              connectionId: tap.connectionId,
              providerMessageId: tap.replyTo,
            },
          },
          select: {
            id: true,
            templateId: true,
            correlation: true,
            template: { select: { type: { select: { key: true } } } },
          },
        })
      : null;

    let eventId: string;
    try {
      const event = await this.prisma.messagingButtonEvent.create({
        data: {
          messageId: tap.messageId,
          connectionId: tap.connectionId,
          contactId: tap.contactId,
          templateId: original?.templateId ?? null,
          originalMessageId: original?.id ?? null,
          typeKey: original?.template?.type.key ?? null,
          buttonKey: decoded.key,
          data: decoded.data,
          correlation: (original?.correlation ?? undefined) as never,
        },
        select: { id: true },
      });
      eventId = event.id;
    } catch (error) {
      // Webhook reentregue: o toque já foi registrado (e enfileirado) na primeira vez.
      if ((error as { code?: string })?.code === 'P2002') return;
      throw error;
    }
    await this.enqueue(eventId);
  }

  private async enqueue(eventId: string): Promise<void> {
    if (!this.queue) {
      this.logger.warn(
        'Fila `messaging-buttons` indisponível: processando de forma síncrona',
      );
      await this.process(eventId).catch((error) =>
        this.logger.error(
          `Evento de botão ${eventId} falhou: ${String(error)}`,
        ),
      );
      return;
    }
    await this.queue.add('button', { eventId }, buttonJobOptions(eventId));
  }

  /** Idempotente: evento já PROCESSED/IGNORED não roda de novo (retentativa e job duplicado são seguros). */
  async process(eventId: string): Promise<void> {
    const event = await this.prisma.messagingButtonEvent.findUnique({
      where: { id: eventId },
      include: {
        message: { include: { contact: { select: { phone: true } } } },
      },
    });
    if (!event || event.status === 'PROCESSED' || event.status === 'IGNORED')
      return;

    const handlers = this.registry.handlersFor(event.typeKey, event.buttonKey);
    if (handlers.length === 0) {
      await this.prisma.messagingButtonEvent.update({
        where: { id: eventId },
        data: { status: 'IGNORED', processedAt: new Date() },
      });
      return;
    }

    await this.prisma.messagingButtonEvent.update({
      where: { id: eventId },
      data: { status: 'PENDING', attempts: { increment: 1 } },
    });
    const payload: ButtonEvent = {
      id: event.id,
      typeKey: event.typeKey,
      buttonKey: event.buttonKey,
      data: event.data,
      phone: event.message.contact.phone,
      connectionId: event.connectionId,
      templateId: event.templateId,
      originalMessageId: event.originalMessageId,
      correlation: (event.correlation as MessageCorrelation | null) ?? null,
      messageId: event.messageId,
      at: event.message.createdAt,
    };

    try {
      for (const handler of handlers) await handler(payload);
    } catch (error) {
      await this.prisma.messagingButtonEvent.update({
        where: { id: eventId },
        data: {
          status: 'FAILED',
          error: String((error as Error)?.message ?? error),
        },
      });
      throw error; // a fila refaz; handlers precisam ser idempotentes
    }
    await this.prisma.messagingButtonEvent.update({
      where: { id: eventId },
      data: { status: 'PROCESSED', processedAt: new Date(), error: null },
    });
  }
}
