import { Injectable, ForbiddenException } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { CheckAccessUseCase } from '../../user-route-access/use-cases/check-access.use-case';
import { CmsAgentBridgeService } from '../services/cms-agent-bridge.service';

const GetCmsDocumentSchema = z.object({
  collection: z
    .string()
    .min(1)
    .describe(
      'Slug da collection do Payload (ex.: "home", "media"). Use describe_cms_schema para saber quais existem.',
    ),
  id: z
    .string()
    .optional()
    .describe('ID do documento. Omitido = lista os documentos da collection.'),
});
type GetCmsDocumentInput = z.infer<typeof GetCmsDocumentSchema>;

@AiToolDef()
@Injectable()
export class GetCmsDocumentTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_cms_document',
    description:
      'Busca um documento do Payload CMS pelo id, ou lista os documentos de uma collection ' +
      'se o id for omitido. Use describe_cms_schema antes para saber quais collections/campos existem.',
    inputSchema: GetCmsDocumentSchema,
    invalidates: [],
    roles: ['ADMIN', 'MODERATOR'],
  };

  constructor(
    private readonly checkAccess: CheckAccessUseCase,
    private readonly cmsBridge: CmsAgentBridgeService,
  ) {}

  async execute(input: GetCmsDocumentInput, ctx: AiToolContext) {
    const hasAccess = await this.checkAccess.execute(ctx.userId, '/cms');
    if (!hasAccess) {
      throw new ForbiddenException('Usuário sem acesso ao CMS');
    }
    return this.cmsBridge.getDocument(input.collection, input.id);
  }
}
