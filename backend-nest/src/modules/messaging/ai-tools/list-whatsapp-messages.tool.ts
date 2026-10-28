import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type { IAiTool, AiToolDefinition } from 'src/domain/ai/ai-tool.types';
import { ListMessagesUseCase } from '../use-cases/list-messages.use-case';

const inputSchema = z.object({
  phone: z.string().optional().describe('Filtra por telefone da contraparte'),
  connectionId: z
    .string()
    .optional()
    .describe('Filtra por conexão (número). Omitido, lista de todas.'),
  direction: z
    .enum(['INBOUND', 'OUTBOUND'])
    .optional()
    .describe('INBOUND = recebidas, OUTBOUND = enviadas'),
  limit: z.number().int().min(1).max(50).optional().describe('Padrão 20'),
});

@AiToolDef()
@Injectable()
export class ListWhatsappMessagesTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_whatsapp_messages',
    description:
      'Lista o histórico de mensagens de WhatsApp, da mais recente para a mais antiga. Use para conferir se uma mensagem saiu, qual o status de entrega dela, ou o que um contato respondeu.',
    inputSchema,
    roles: ['ADMIN'],
  };

  constructor(private readonly listMessages: ListMessagesUseCase) {}

  async execute(input: unknown) {
    const params = inputSchema.parse(input);
    const result = await this.listMessages.execute({
      page: 1,
      pagination: true,
      ...params,
      limit: params.limit ?? 20,
    });
    const messages = Array.isArray(result) ? result : result.data;
    const total = Array.isArray(result) ? messages.length : result.meta.total;

    // O modelo não precisa de `raw` nem de ids internos — só do que descreve a mensagem.
    return {
      total,
      messages: messages.map((m) => ({
        phone: m.phone,
        direction: m.direction,
        status: m.status,
        type: m.type,
        text: m.text,
        error: m.error,
        at: m.createdAt,
      })),
    };
  }
}
