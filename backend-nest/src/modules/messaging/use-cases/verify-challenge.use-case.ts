import { Injectable } from '@nestjs/common';
import { MessagingConnectionService } from '../messaging-connection.service';
import { MessagingWebhookService } from '../messaging-webhook.service';
import { timingSafeCompare } from '../providers/webhook.util';

/** Só a Meta faz handshake; nos Evolution, responder 200 à chave certa mantém o endpoint verificável. */
@Injectable()
export class VerifyWebhookChallengeUseCase {
  constructor(
    private readonly webhooks: MessagingWebhookService,
    private readonly connections: MessagingConnectionService,
  ) {}

  async execute(
    query: Record<string, string | undefined>,
  ): Promise<string | null> {
    const expectedKey = await this.webhooks.webhookKey();
    // Sem chave configurada o endpoint não tem como autenticar ninguém: recusa (falha fechada).
    if (!expectedKey || !timingSafeCompare(query['key'] ?? '', expectedKey)) {
      return null;
    }

    const connection = await this.connectionOf(query['connection']);
    if (!connection) return null;

    try {
      return this.connections.use(connection).verifyChallenge?.(query) ?? '';
    } catch {
      return null;
    }
  }

  /** Sem `connection` na URL (webhook antigo): vale se houver uma só conexão. */
  private async connectionOf(connectionId: string | undefined) {
    if (connectionId)
      return this.connections.get(connectionId).catch(() => null);
    const all = await this.connections.list();
    return all.length === 1 ? all[0] : null;
  }
}
