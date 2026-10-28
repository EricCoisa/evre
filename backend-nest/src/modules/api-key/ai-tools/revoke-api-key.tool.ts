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
import { RevokeApiKeyUseCase } from '../use-cases/revoke-api-key.use-case';

const RevokeApiKeySchema = z.object({ id: z.string().uuid() });
type RevokeApiKeyInput = z.infer<typeof RevokeApiKeySchema>;

@AiToolDef()
@Injectable()
export class RevokeApiKeyTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'revoke_api_key',
    description:
      'Revoga uma API key pelo id. ADMIN pode revogar qualquer chave; demais usuários só as próprias.',
    inputSchema: RevokeApiKeySchema,
    approvalScope: McpScopes.API_KEYS_WRITE,
    invalidates: [InvalidationTags.API_KEYS],
  };

  constructor(private readonly revokeApiKeyUseCase: RevokeApiKeyUseCase) {}

  execute(input: RevokeApiKeyInput, ctx: AiToolContext) {
    return this.revokeApiKeyUseCase.execute(
      input.id,
      ctx.userId,
      ctx.roleName === 'ADMIN',
    );
  }
}
