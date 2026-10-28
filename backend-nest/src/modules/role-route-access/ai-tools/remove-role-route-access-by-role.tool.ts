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
import { RemoveByRoleUseCase } from '../use-cases/remove-by-role.use-case';

const RemoveByRoleSchema = z.object({ roleId: z.string().uuid() });
type RemoveByRoleInput = z.infer<typeof RemoveByRoleSchema>;

@AiToolDef()
@Injectable()
export class RemoveRoleRouteAccessByRoleTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'remove_role_route_access_by_role',
    description:
      'Revoga TODOS os acessos de rota de um role de uma vez. Ação de alto impacto — use com cautela.',
    inputSchema: RemoveByRoleSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.ROLE_ROUTE_ACCESS_WRITE,
    invalidates: [InvalidationTags.ROLE_ROUTE_ACCESS],
  };

  constructor(private readonly removeByRoleUseCase: RemoveByRoleUseCase) {}

  execute(input: RemoveByRoleInput, ctx: AiToolContext) {
    return this.removeByRoleUseCase.execute(input.roleId, ctx.userId);
  }
}
