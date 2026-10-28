import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type { IAiTool, AiToolDefinition } from 'src/domain/ai/ai-tool.types';
import { MessagingService } from '../messaging.service';
import { MessagingConnectionService } from '../messaging-connection.service';
import { MessagingConnectionStateService } from '../messaging-connection-state.service';

/** Conexões + saúde + sessão para diagnóstico. Credencial nunca sai — só 'configurada'/'não configurada'. */
@AiToolDef()
@Injectable()
export class GetMessagingConfigTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_messaging_config',
    description:
      'Lista as conexões de mensageria (cada uma é um número de WhatsApp acessado por um provider) com a saúde e o estado da sessão de cada uma. Credenciais NÃO são retornadas — apenas se estão preenchidas. Use para diagnosticar por que uma mensagem não foi enviada ou recebida.',
    inputSchema: z.object({}),
    roles: ['ADMIN'],
  };

  constructor(
    private readonly connections: MessagingConnectionService,
    private readonly state: MessagingConnectionStateService,
    private readonly messagingService: MessagingService,
  ) {}

  async execute() {
    const enabled = await this.messagingService.isEnabled();
    const all = await this.connections.list();

    return {
      enabled,
      connections: await Promise.all(
        all.map(async (connection) => ({
          ...this.connections.view(connection),
          health: await this.state.health(connection),
          session: await this.sessionOrNull(connection),
        })),
      ),
    };
  }

  /** Sessão é best-effort no diagnóstico: provider fora do ar não pode derrubar a tool. */
  private async sessionOrNull(
    connection: Parameters<MessagingConnectionStateService['status']>[0],
  ) {
    try {
      const session = await this.state.status(connection);
      return session.supported ? session : null;
    } catch (error) {
      return { error: String((error as Error)?.message ?? error) };
    }
  }
}
