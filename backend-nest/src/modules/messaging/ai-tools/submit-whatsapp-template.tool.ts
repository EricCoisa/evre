import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type { IAiTool, AiToolDefinition } from 'src/domain/ai/ai-tool.types';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import { SubmitTemplateSchema } from '../dto/messaging-template-submission.dto';
import { SubmitTemplateUseCase } from '../use-cases/submit-template.use-case';

const inputSchema = SubmitTemplateSchema.extend({
  templateId: z
    .string()
    .min(1)
    .describe(
      'Id do template (create_whatsapp_template / list_whatsapp_templates)',
    ),
  connectionId: z
    .string()
    .min(1)
    .describe('Conexão (WABA) que receberá o template'),
  examples: z
    .record(z.string())
    .default({})
    .describe(
      'Valor de exemplo por variável do tipo (nome → valor realista); a Meta exige para revisar. As reservadas o sistema preenche',
    ),
});

/** Submete o template à aprovação do provider, como tool separada da criação. */
@AiToolDef()
@Injectable()
export class SubmitWhatsappTemplateTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'submit_whatsapp_template',
    description:
      'Envia um template do catálogo para APROVAÇÃO na Meta (ação externa: a Meta limita a edição de template aprovado e a revisão pode reprovar). Só submeta depois de criar o rascunho, revisar `metaRules` e ter exemplos realistas para as variáveis. Recusa template inválido ("requer ajuste") ou que viole as regras de erro da Meta. O resultado inicial costuma ser PENDING; a decisão chega depois (webhook/sincronização).',
    inputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.MESSAGING_WRITE,
    invalidates: [InvalidationTags.MESSAGING],
  };

  constructor(private readonly submitTemplate: SubmitTemplateUseCase) {}

  async execute(input: unknown) {
    const { templateId, ...dto } = inputSchema.parse(input);
    const submission = await this.submitTemplate.execute(templateId, dto);
    return {
      templateId,
      connectionId: submission.connectionId,
      status: submission.status,
      reason: submission.reason ?? null,
    };
  }
}
