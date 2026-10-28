import { Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type { IAiTool, AiToolDefinition } from 'src/domain/ai/ai-tool.types';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMessagingTemplateSchema } from '../dto/messaging-template.dto';
import { checkMetaTemplateRules } from '../providers/meta-template-rules';
import { CreateTemplateUseCase } from '../use-cases/create-template.use-case';

// `bypassOptOut` fica de fora: furar o opt-out é decisão humana, nunca do agente.
// `typeKey` no lugar de `typeId`: o agente conhece a chave (list_whatsapp_template_types).
const inputSchema = CreateMessagingTemplateSchema.omit({
  typeId: true,
  bypassOptOut: true,
}).extend({
  typeKey: z
    .string()
    .min(1)
    .describe(
      'Chave do tipo (list_whatsapp_template_types). O tipo é o contrato: o texto só usa as variáveis e botões dele',
    ),
});

/** Cria o rascunho de um template no catálogo, sem enviar nada ao provider. */
@AiToolDef()
@Injectable()
export class CreateWhatsappTemplateTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'create_whatsapp_template',
    description:
      'Cria o rascunho de um template de WhatsApp no catálogo (NÃO envia à Meta — para isso use submit_whatsapp_template). Escolha o tipo com list_whatsapp_template_types: o texto só pode usar `{{ variável }}` do tipo (todas as obrigatórias precisam aparecer) e os botões do tipo precisam ser declarados em `buttons` com o `slot` (botões `URL` do tipo usam o link do sistema). Devolve `metaRules` com os erros/avisos que a Meta aplicaria: corrija os erros (corpo não começa nem termina com variável, sem variáveis coladas, sem encurtador de link…) antes de submeter. Você não cria nem altera tipos.',
    inputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.MESSAGING_WRITE,
    invalidates: [InvalidationTags.MESSAGING],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly createTemplate: CreateTemplateUseCase,
  ) {}

  async execute(input: unknown) {
    const { typeKey, ...rest } = inputSchema.parse(input);
    const type = await this.prisma.messagingTemplateType.findUnique({
      where: { key: typeKey },
      select: { id: true },
    });
    if (!type) {
      throw new NotFoundException(`tipo de template ${typeKey} não encontrado`);
    }

    const created = await this.createTemplate.execute({
      ...rest,
      typeId: type.id,
    });

    return {
      id: created.id,
      key: created.key,
      language: created.language,
      status: 'DRAFT',
      submitted: false,
      metaRules: checkMetaTemplateRules({
        category: created.category,
        body: created.body,
        header: rest.header,
        footer: created.footer,
        buttons: (created.buttons as never) ?? undefined,
      }),
    };
  }
}
