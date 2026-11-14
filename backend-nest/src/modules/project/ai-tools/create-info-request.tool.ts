import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { CreateInfoRequestUseCase } from '../use-cases/create-info-request.use-case';

const CreateInfoRequestInputSchema = z
  .object({
    projectId: z.string().uuid(),
    label: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
  })
  .strict();
type CreateInfoRequestInput = z.infer<typeof CreateInfoRequestInputSchema>;

@AiToolDef()
@Injectable()
export class CreateInfoRequestTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'create_info_request',
    description:
      'Cria um pedido de informação ao cliente dentro de um projeto (ex.: "CNPJ da empresa"). O valor respondido é sensível e não é lido por esta ferramenta — use a tela do projeto para consultá-lo.',
    inputSchema: CreateInfoRequestInputSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly createInfoRequest: CreateInfoRequestUseCase) {}

  execute(input: CreateInfoRequestInput, ctx: AiToolContext) {
    const { projectId, ...dto } = input;
    return this.createInfoRequest.execute(
      projectId,
      dto,
      toAuthenticatedUser(ctx),
    );
  }
}
