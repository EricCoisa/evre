import {
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type {
  MessagingEvent,
  WebhookRequest,
} from 'src/domain/interface/messaging-provider.interface';
import type { MessagingConnection } from '@prisma/client';
import { MessagingService } from '../messaging.service';
import { MessagingWebhookService } from '../messaging-webhook.service';
import { MessagingConnectionService } from '../messaging-connection.service';
import { timingSafeCompare } from '../providers/webhook.util';
import { INBOUND_JOB_OPTIONS, MESSAGING_QUEUE } from '../messaging-queue.const';

/** Camada 0 (chave da URL) → camada 1 (assinatura nativa do provider) → fila; responder rápido é requisito. */
@Injectable()
export class ReceiveWebhookUseCase {
  private readonly logger = new Logger(ReceiveWebhookUseCase.name);

  constructor(
    private readonly messagingService: MessagingService,
    private readonly webhooks: MessagingWebhookService,
    private readonly connections: MessagingConnectionService,
    @Optional()
    @InjectQueue(MESSAGING_QUEUE.INBOUND)
    private readonly queue: Queue | null,
  ) {}

  async execute(req: WebhookRequest): Promise<{ accepted: boolean }> {
    await this.assertKey(req);

    // Corpo inválido é 401, não 500 — a chave da URL (camada 0) já passou nesse ponto.
    const body = this.parseBody(req);
    if (body === null) throw new UnauthorizedException();

    const connection = await this.resolveConnection(req.query['connection']);
    const provider = this.connections.use(connection);
    if (!provider.verifyWebhook(req)) {
      this.logger.warn('Webhook recusado: assinatura do provider inválida');
      throw new UnauthorizedException();
    }

    // Presença é efêmera: não entra na fila (sem retentativa) e não é gravada.
    const events = await this.messagingService.dropIgnored(
      provider.parseWebhook(body),
    );
    const presenceEvents = events.filter(
      (event): event is Extract<MessagingEvent, { kind: 'PRESENCE' }> =>
        event.kind === 'PRESENCE',
    );
    if (events.length > 0 && presenceEvents.length === events.length) {
      for (const event of presenceEvents) {
        this.messagingService.emitPresence(connection.id, event);
      }
      return { accepted: true };
    }

    if (!this.queue) {
      await this.messagingService.ingest(connection.id, body);
      return { accepted: true };
    }
    await this.queue.add(
      'inbound',
      { connectionId: connection.id, body },
      INBOUND_JOB_OPTIONS,
    );
    return { accepted: true };
  }

  /** De qual conexão é, pelo `connection` da URL; sem ele, só resta o caso de uma conexão só. */
  private async resolveConnection(
    connectionId: string | undefined,
  ): Promise<MessagingConnection> {
    const connection = connectionId
      ? await this.connections.getActive(connectionId).catch(() => null)
      : await this.soleConnection();
    if (!connection) {
      this.logger.warn('Webhook recusado: conexão ausente ou desconhecida');
      throw new UnauthorizedException();
    }
    return connection;
  }

  private async soleConnection(): Promise<MessagingConnection | null> {
    const all = await this.connections.list();
    return all.length === 1 ? all[0] : null;
  }

  /** Chave de acesso comum aos três providers, conferida antes de tocar no corpo; sem ela, recusa tudo. */
  private async assertKey(req: WebhookRequest): Promise<void> {
    const expected = await this.webhooks.webhookKey();
    if (!expected) {
      this.logger.warn(
        'Webhook recusado: a chave de acesso não está configurada (SYSTEM_MESSAGING_WEBHOOK_KEY)',
      );
      throw new UnauthorizedException();
    }
    if (!timingSafeCompare(req.query['key'] ?? '', expected)) {
      this.logger.warn('Webhook recusado: chave de acesso ausente ou inválida');
      throw new UnauthorizedException();
    }
  }

  /** Corpo cru ainda não confiável: JSON quebrado é 401, não 500. */
  private parseBody(req: WebhookRequest): unknown {
    try {
      const parsed: unknown = JSON.parse(req.raw.toString('utf8'));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      this.logger.warn('Webhook recusado: corpo não é JSON');
      return null;
    }
  }
}
