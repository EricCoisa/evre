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
import { RevokeAccessUseCase } from '../use-cases/revoke-access.use-case';

const RevokeUserRouteAccessSchema = z.object({
  userId: z.string().uuid(),
  routeId: z.string().uuid(),
});
type RevokeUserRouteAccessInput = z.infer<typeof RevokeUserRouteAccessSchema>;

@AiToolDef()
@Injectable()
export class RevokeUserRouteAccessTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'revoke_user_route_access',
    description: 'Revoga o acesso de um usuário a uma rota específica.',
    inputSchema: RevokeUserRouteAccessSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.USER_ROUTE_ACCESS_WRITE,
    invalidates: [InvalidationTags.USER_ROUTE_ACCESS],
  };

  constructor(private readonly revokeAccessUseCase: RevokeAccessUseCase) {}

  execute(input: RevokeUserRouteAccessInput, ctx: AiToolContext) {
    return this.revokeAccessUseCase.execute(
      input.userId,
      input.routeId,
      ctx.userId,
    );
  }
}
