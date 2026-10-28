import { Injectable, ForbiddenException } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { CheckAccessUseCase } from '../../user-route-access/use-cases/check-access.use-case';
import { CmsAgentBridgeService } from '../services/cms-agent-bridge.service';

const UpdateCmsDocumentSchema = z.object({
  collection: z
    .string()
    .min(1)
    .describe('Slug da collection do Payload (ex.: "home", "media").'),
  id: z.string().min(1).describe('ID do documento a atualizar.'),
  data: z
    .record(z.string(), z.unknown())
    .describe(
      'Campos a atualizar, como existem HOJE no schema (use describe_cms_schema antes). ' +
        'Campo inexistente ou de tipo errado é rejeitado pelo próprio Payload.',
    ),
});
type UpdateCmsDocumentInput = z.infer<typeof UpdateCmsDocumentSchema>;

@AiToolDef()
@Injectable()
export class UpdateCmsDocumentTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_cms_document',
    description:
      'Atualiza campos de um documento do Payload CMS (ex.: conteúdo da página Home). ' +
      'SEMPRE chame describe_cms_schema antes — o schema do CMS muda com o tempo e esta tool ' +
      'não tem uma lista fixa de campos válidos; a validação acontece no próprio Payload.',
    inputSchema: UpdateCmsDocumentSchema,
    approvalScope: McpScopes.CMS_WRITE,
    invalidates: [InvalidationTags.CMS],
    roles: ['ADMIN', 'MODERATOR'],
  };

  constructor(
    private readonly checkAccess: CheckAccessUseCase,
    private readonly cmsBridge: CmsAgentBridgeService,
  ) {}

  async execute(input: UpdateCmsDocumentInput, ctx: AiToolContext) {
    const hasAccess = await this.checkAccess.execute(ctx.userId, '/cms');
    if (!hasAccess) {
      throw new ForbiddenException('Usuário sem acesso ao CMS');
    }
    return this.cmsBridge.updateDocument(
      input.collection,
      input.id,
      input.data,
    );
  }
}
