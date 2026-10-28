import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type { IAiTool, AiToolDefinition } from 'src/domain/ai/ai-tool.types';
import {
  allowedReserved,
  splitTypeVariables,
} from 'src/domain/messaging/messaging-variables.const';
import { PrismaService } from 'src/prisma/prisma.service';
import type { TemplateVariable } from '../dto/messaging-template-type.dto';

const inputSchema = z.object({
  key: z.string().optional().describe('Filtra pela chave do template'),
  connectionId: z
    .string()
    .optional()
    .describe('Conexão: devolve também o status de aprovação nela'),
});

/** Catálogo de templates com o que o agente precisa informar para enviar cada um. */
@AiToolDef()
@Injectable()
export class ListWhatsappTemplatesTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_whatsapp_templates',
    description:
      'Lista os templates de WhatsApp do catálogo e as variáveis de cada um: `values` (você informa), `reserved.provide` (você informa) e `reserved.auto` (o sistema preenche pelo contato — não informe). Use antes de send_whatsapp_template. Respeite `sendableByAgent`: false = não envie (template inválido ou com link do sistema, que exige um token que só o código informa). Em conexão Meta só template APROVADO pode ser enviado, e mensagem livre só dentro da janela de atendimento; fora dela, só template.',
    inputSchema,
    roles: ['ADMIN'],
  };

  constructor(private readonly prisma: PrismaService) {}

  async execute(input: unknown) {
    const { key, connectionId } = inputSchema.parse(input);
    const rows = await this.prisma.messagingTemplate.findMany({
      where: key ? { key } : {},
      orderBy: [{ key: 'asc' }, { language: 'asc' }],
      include: {
        type: true,
        ...(connectionId ? { submissions: { where: { connectionId } } } : {}),
      },
    });

    return rows.map((row) => {
      const stored = row.type.variables as unknown as TemplateVariable[];
      const { custom, reservedNames } = splitTypeVariables(stored);
      const reserved = allowedReserved(reservedNames);
      const buttons = (Array.isArray(row.buttons)
        ? row.buttons
        : []) as unknown as {
        kind: string;
        label: string;
        slot?: string;
      }[];
      const needsSystemLink = buttons.some((b) => b.slot && b.kind === 'URL');
      const submissions = (row as { submissions?: { status: string }[] })
        .submissions;
      return {
        id: row.id,
        key: row.key,
        language: row.language,
        body: row.body,
        typeKey: row.type.key,
        invalid: !!row.invalidatedAt,
        invalidReason: row.invalidReason ?? null,
        buttons: buttons.map((b) => ({
          kind: b.kind,
          label: b.label,
          // Botão do tipo (com `slot`) é controlado pelo sistema; sem `slot` é texto/link fixo do template.
          slot: b.slot ?? null,
        })),
        sendableByAgent: !row.invalidatedAt && !needsSystemLink,
        notSendableReason: row.invalidatedAt
          ? (row.invalidReason ?? 'template inválido (requer ajuste)')
          : needsSystemLink
            ? 'tem link do sistema: o sufixo é informado só pelo código'
            : null,
        approvalStatus: connectionId
          ? (submissions?.[0]?.status ?? null)
          : undefined,
        values: custom.map((v) => ({
          name: v.name,
          type: v.type,
          required: v.required,
          default: v.default,
          // Valor sensível não passa pelo agente: o envio é recusado (ver send_whatsapp_template).
          sensitive: !!v.sensitive,
        })),
        reserved: {
          provide: reserved.filter((v) => !v.fromContext).map((v) => v.name),
          auto: reserved.filter((v) => v.fromContext).map((v) => v.name),
        },
      };
    });
  }
}
