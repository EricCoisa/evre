import { Injectable, Logger } from '@nestjs/common';
import {
  MessagingConnectionService,
  type ConnectionView,
} from '../messaging-connection.service';
import { MessagingConnectionStateService } from '../messaging-connection-state.service';
import { MessagingEventsService } from '../messaging-events.service';

/** Arquiva a conexão: bloqueia eventos, desliga o webhook e limpa a instância no provider (best-effort), liberando o número e mantendo o histórico. */
@Injectable()
export class ArchiveConnectionUseCase {
  private readonly logger = new Logger(ArchiveConnectionUseCase.name);

  constructor(
    private readonly connections: MessagingConnectionService,
    private readonly state: MessagingConnectionStateService,
    private readonly events: MessagingEventsService,
  ) {}

  async execute(id: string): Promise<ConnectionView> {
    const connection = await this.connections.get(id);
    const archived = connection.archivedAt
      ? connection
      : await this.connections.archive(id);

    if (!connection.archivedAt) {
      await this.unregisterWebhookQuietly(connection);
      await this.disconnectQuietly(connection);
      await this.deleteInstanceQuietly(connection);
    }

    // Estado e health guardados eram da conexão em uso.
    await this.state.reset(id);
    this.events.emit({ type: 'connection' });
    return this.connections.view(archived);
  }

  private async unregisterWebhookQuietly(
    connection: Awaited<ReturnType<MessagingConnectionService['get']>>,
  ): Promise<void> {
    try {
      const provider = this.connections.use(connection);
      if (!provider.unregisterWebhook) return;
      const result = await provider.unregisterWebhook();
      if (!result.status) {
        this.logger.warn(
          `Conexão ${connection.id} arquivada sem desligar o webhook no provider: ${result.data}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Conexão ${connection.id} arquivada sem desligar o webhook no provider: ${String((error as Error)?.message ?? error)}`,
      );
    }
  }

  private async disconnectQuietly(
    connection: Awaited<ReturnType<MessagingConnectionService['get']>>,
  ): Promise<void> {
    try {
      const provider = this.connections.use(connection);
      if (!provider.session) return;
      const result = await provider.session.disconnect();
      if (!result.status) {
        this.logger.warn(
          `Conexão ${connection.id} arquivada sem desparear no provider: ${result.data}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Conexão ${connection.id} arquivada sem desparear no provider: ${String((error as Error)?.message ?? error)}`,
      );
    }
  }

  private async deleteInstanceQuietly(
    connection: Awaited<ReturnType<MessagingConnectionService['get']>>,
  ): Promise<void> {
    try {
      const provider = this.connections.use(connection);
      if (!provider.deleteInstance) return;
      const result = await provider.deleteInstance();
      if (!result.status) {
        this.logger.warn(
          `Conexão ${connection.id} arquivada sem apagar a instância no provider: ${result.data}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Conexão ${connection.id} arquivada sem apagar a instância no provider: ${String((error as Error)?.message ?? error)}`,
      );
    }
  }
}
