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
import { RemoveRoleRouteAccessUseCase } from '../use-cases/remove.use-case';

const RemoveRoleRouteAccessSchema = z.object({
  roleId: z.string().uuid(),
  routeId: z.string().uuid(),
});
type RemoveRoleRouteAccessInput = z.infer<typeof RemoveRoleRouteAccessSchema>;

@AiToolDef()
@Injectable()
export class RemoveRoleRouteAccessTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'remove_role_route_access',
    description: 'Revoga o acesso de um role a uma rota específica.',
    inputSchema: RemoveRoleRouteAccessSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.ROLE_ROUTE_ACCESS_WRITE,
    invalidates: [InvalidationTags.ROLE_ROUTE_ACCESS],
  };

  constructor(private readonly removeUseCase: RemoveRoleRouteAccessUseCase) {}

  execute(input: RemoveRoleRouteAccessInput, ctx: AiToolContext) {
    return this.removeUseCase.execute(ctx.userId, input.roleId, input.routeId);
  }
}
