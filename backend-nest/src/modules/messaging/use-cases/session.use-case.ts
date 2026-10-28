import { Injectable, Logger } from '@nestjs/common';
import type { MessagingSession } from 'src/domain/interface/messaging-provider.interface';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import { MessagingConnectionService } from '../messaging-connection.service';
import {
  MessagingConnectionStateService,
  type SessionView,
} from '../messaging-connection-state.service';
import { MessagingWebhookService } from '../messaging-webhook.service';

/** Pareamento por QR de uma conexão, usado só em provider de WhatsApp Web. */
@Injectable()
export class MessagingSessionUseCase {
  private readonly logger = new Logger(MessagingSessionUseCase.name);

  constructor(
    private readonly connections: MessagingConnectionService,
    private readonly state: MessagingConnectionStateService,
    private readonly webhooks: MessagingWebhookService,
  ) {}

  /** Registra o webhook antes de pedir o QR, best-effort. */
  async connect(connectionId: string): Promise<MessagingSession> {
    const connection = await this.connections.getActive(connectionId);

    const registered = await this.webhooks.registerWebhook(connectionId);
    if (!registered.status) {
      this.logger.warn(
        `Webhook não registrado antes de conectar: ${registered.data}`,
      );
    }

    return this.state.connect(connection);
  }

  /** Lê o estado empurrado por webhook; só confere no provider quando ele envelheceu. */
  async status(connectionId: string): Promise<SessionView> {
    return this.state.status(await this.connections.getActive(connectionId));
  }

  async disconnect(connectionId: string): Promise<ProviderResult> {
    return this.state.disconnect(
      await this.connections.getActive(connectionId),
    );
  }
}
