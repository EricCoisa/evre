import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolContext,
  AiToolDefinition,
} from 'src/domain/ai/ai-tool.types';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { MESSAGING_LIMITS } from 'src/domain/messaging/messaging.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import { MessagingService } from '../messaging.service';

const inputSchema = z.object({
  phone: z
    .string()
    .max(MESSAGING_LIMITS.phone)
    .describe('Telefone do destinatário com DDI, ex.: 5511987654321'),
  text: z
    .string()
    .min(1)
    .max(MESSAGING_LIMITS.text)
    .describe('Texto da mensagem'),
  connectionId: z
    .string()
    .max(MESSAGING_LIMITS.id)
    .optional()
    .describe(
      'Conexão (número) que envia — veja get_messaging_config. Omitido, usa a conexão padrão.',
    ),
});

/** Envia WhatsApp pelo provider ativo. Escrita: exige aprovação do scope. */
@AiToolDef()
@Injectable()
export class SendWhatsappMessageTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'send_whatsapp_message',
    description:
      'Envia uma mensagem de WhatsApp para um telefone. A mensagem é enfileirada e entregue pelo provider configurado. Recusa o envio se o contato tiver pedido para não receber mensagens (opt-out) e, em conexão com janela de atendimento (Meta, 24h), texto livre fora da janela (sem mensagem do contato nas últimas 24h) — nesse caso use send_whatsapp_template.',
    inputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.MESSAGING_WRITE,
    invalidates: [InvalidationTags.MESSAGING],
  };

  constructor(private readonly messagingService: MessagingService) {}

  async execute(input: unknown, ctx: AiToolContext) {
    const { phone, text, connectionId } = inputSchema.parse(input);
    // userId vem do contexto autenticado, NUNCA do input — o agente não envia por outra pessoa.
    const id = await this.messagingService.send(
      { type: 'TEXT', phone, text },
      { userId: ctx.userId, connectionId },
    );
    return { id, status: 'QUEUED' };
  }
}
