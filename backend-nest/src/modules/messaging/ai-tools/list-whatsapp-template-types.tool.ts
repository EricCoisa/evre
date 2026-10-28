import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type { IAiTool, AiToolDefinition } from 'src/domain/ai/ai-tool.types';
import {
  effectiveButtonSlots,
  type StoredTypeButton,
} from 'src/domain/messaging/messaging-buttons.const';
import {
  allowedReserved,
  splitTypeVariables,
} from 'src/domain/messaging/messaging-variables.const';
import { PrismaService } from 'src/prisma/prisma.service';
import type { TemplateVariable } from '../dto/messaging-template-type.dto';

const inputSchema = z.object({
  key: z.string().optional().describe('Filtra pela chave do tipo'),
});

/** Lista os tipos de template, só leitura — criar ou alterar tipo é decisão de código, não do agente. */
@AiToolDef()
@Injectable()
export class ListWhatsappTemplateTypesTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_whatsapp_template_types',
    description:
      'Lista os tipos de template de WhatsApp (somente leitura): o contrato de cada tipo — variáveis (custom e reservadas) e botões (`QUICK_REPLY` gera evento no toque; `URL` é link do sistema, cujo sufixo só o código informa) — e quantos templates o usam. Você não cria nem altera tipos.',
    inputSchema,
    roles: ['ADMIN'],
  };

  constructor(private readonly prisma: PrismaService) {}

  async execute(input: unknown) {
    const { key } = inputSchema.parse(input);
    const rows = await this.prisma.messagingTemplateType.findMany({
      where: key ? { key } : {},
      orderBy: { key: 'asc' },
      include: { _count: { select: { templates: true } } },
    });

    return rows.map((row) => {
      const { custom, reservedNames } = splitTypeVariables(
        row.variables as unknown as TemplateVariable[],
      );
      const reserved = allowedReserved(reservedNames);
      return {
        id: row.id,
        key: row.key,
        name: row.name,
        templatesCount: row._count.templates,
        variables: custom.map((v) => ({
          name: v.name,
          type: v.type,
          required: v.required,
          default: v.default,
          sensitive: !!v.sensitive,
        })),
        reserved: {
          provide: reserved.filter((v) => !v.fromContext).map((v) => v.name),
          auto: reserved.filter((v) => v.fromContext).map((v) => v.name),
        },
        buttons: effectiveButtonSlots(
          row.buttons as unknown as StoredTypeButton[],
        ).map((slot) => ({
          key: slot.key,
          kind: slot.kind,
          reserved: slot.reserved,
          required: slot.required,
          systemLink: slot.kind === 'URL',
        })),
      };
    });
  }
}
