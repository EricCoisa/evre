import { BadRequestException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolContext,
  AiToolDefinition,
} from 'src/domain/ai/ai-tool.types';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import { MESSAGING_LIMITS } from 'src/domain/messaging/messaging.const';
import {
  RESERVED_LIST,
  type ReservedValues,
} from 'src/domain/messaging/messaging-variables.const';
import { MessagingService } from '../messaging.service';

const inputSchema = z
  .object({
    phone: z
      .string()
      .max(MESSAGING_LIMITS.phone)
      .describe('Telefone do destinatário com DDI, ex.: 5511987654321'),
    templateId: z
      .string()
      .optional()
      .describe('Id do template (list_whatsapp_templates)'),
    templateKey: z
      .string()
      .optional()
      .describe('Chave do template, alternativa ao id'),
    language: z
      .string()
      .optional()
      .describe('Idioma com templateKey. Padrão pt-BR'),
    values: z
      .record(z.string())
      .optional()
      .describe(
        'Variáveis do template (campo `values` de list_whatsapp_templates), nome → valor',
      ),
    reserved: z
      .record(z.string())
      .optional()
      .describe(
        'Só as de `reserved.provide`, nome → valor. As de `reserved.auto` o sistema preenche',
      ),
    connectionId: z
      .string()
      .optional()
      .describe('Conexão que envia. Omitido, a padrão.'),
  })
  .refine((v) => v.templateId || v.templateKey, {
    message: 'informe templateId ou templateKey',
  });

/** Envia um template do catálogo. Escrita: exige aprovação do scope. */
@AiToolDef()
@Injectable()
export class SendWhatsappTemplateTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'send_whatsapp_template',
    description:
      'Envia um template de WhatsApp do catálogo, com as variáveis preenchidas. Descubra templates e variáveis com list_whatsapp_templates. Variáveis reservadas de `auto` (ex.: primeiro nome) o sistema preenche pelo contato. Recusa template inválido, template com link do sistema (o sufixo só o código informa — veja `sendableByAgent`), variável sensível, contato em opt-out e, em conexão Meta, template não aprovado. Botões de resposta rápida seguem o template; você não os configura.',
    inputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.MESSAGING_WRITE,
    invalidates: [InvalidationTags.MESSAGING],
  };

  constructor(private readonly messagingService: MessagingService) {}

  async execute(input: unknown, ctx: AiToolContext) {
    const {
      phone,
      templateId,
      templateKey,
      language,
      values,
      reserved,
      connectionId,
    } = inputSchema.parse(input);
    const id = await this.messagingService.sendTemplate(
      {
        phone,
        templateId,
        key: templateKey,
        language,
        values,
        reserved: this.providedReserved(reserved),
        allowSensitive: false,
      },
      // userId vem do contexto autenticado, NUNCA do input — o agente não envia por outra pessoa.
      { userId: ctx.userId, connectionId },
    );
    return { id, status: 'QUEUED' };
  }

  /** O agente só informa reservadas sem origem no contexto; as do contato ele não consegue sobrescrever. */
  private providedReserved(
    raw: Record<string, string> | undefined,
  ): ReservedValues | undefined {
    if (!raw) return undefined;
    const allowed = new Set<string>(
      RESERVED_LIST.filter((v) => !v.fromContext).map((v) => v.name),
    );
    const invalid = Object.keys(raw).filter((name) => !allowed.has(name));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `reserved aceita só variáveis de \`reserved.provide\`; recusado: ${invalid.join(', ')}`,
      );
    }
    return raw;
  }
}
