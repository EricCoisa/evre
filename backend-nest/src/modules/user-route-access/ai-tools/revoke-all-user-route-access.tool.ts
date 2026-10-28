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
import { RevokeAllAccessUseCase } from '../use-cases/revoke-all-access.use-case';

const RevokeAllUserRouteAccessSchema = z.object({ userId: z.string().uuid() });
type RevokeAllUserRouteAccessInput = z.infer<
  typeof RevokeAllUserRouteAccessSchema
>;

@AiToolDef()
@Injectable()
export class RevokeAllUserRouteAccessTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'revoke_all_user_route_access',
    description:
      'Revoga TODOS os acessos de rota de um usuário de uma vez. Ação de alto impacto — use com cautela.',
    inputSchema: RevokeAllUserRouteAccessSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.USER_ROUTE_ACCESS_WRITE,
    invalidates: [InvalidationTags.USER_ROUTE_ACCESS],
  };

  constructor(
    private readonly revokeAllAccessUseCase: RevokeAllAccessUseCase,
  ) {}

  execute(input: RevokeAllUserRouteAccessInput, ctx: AiToolContext) {
    return this.revokeAllAccessUseCase.execute(input.userId, ctx.userId);
  }
}
