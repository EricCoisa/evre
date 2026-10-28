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
import { UpdateApiKeyScopesUseCase } from '../use-cases/update-api-key-scopes.use-case';
import { UpdateApiKeyScopesSchema } from '../dto/update-api-key-scopes.dto';

const UpdateApiKeyScopesToolSchema = z
  .object({ id: z.string().uuid() })
  .extend(UpdateApiKeyScopesSchema.shape);
type UpdateApiKeyScopesInput = z.infer<typeof UpdateApiKeyScopesToolSchema>;

@AiToolDef()
@Injectable()
export class UpdateApiKeyScopesTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_api_key_scopes',
    description:
      'Atualiza os scopes de uma API key pelo id. ADMIN pode alterar qualquer chave; demais usuários só as próprias.',
    inputSchema: UpdateApiKeyScopesToolSchema,
    approvalScope: McpScopes.API_KEYS_WRITE,
    invalidates: [InvalidationTags.API_KEYS],
  };

  constructor(
    private readonly updateApiKeyScopesUseCase: UpdateApiKeyScopesUseCase,
  ) {}

  execute(input: UpdateApiKeyScopesInput, ctx: AiToolContext) {
    return this.updateApiKeyScopesUseCase.execute(
      input.id,
      input.scopes,
      ctx.userId,
      ctx.roleName === 'ADMIN',
    );
  }
}
