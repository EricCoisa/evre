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
import { CreateRoleRouteAccessUseCase } from '../use-cases/create.use-case';
import { CreateRoleRouteAccessSchema } from '../dto/create-role-route-access.dto';

type GrantRoleRouteAccessInput = z.infer<typeof CreateRoleRouteAccessSchema>;

@AiToolDef()
@Injectable()
export class GrantRoleRouteAccessTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'grant_role_route_access',
    description: 'Concede a um role acesso a uma rota do sistema.',
    inputSchema: CreateRoleRouteAccessSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.ROLE_ROUTE_ACCESS_WRITE,
    invalidates: [InvalidationTags.ROLE_ROUTE_ACCESS],
  };

  constructor(private readonly createUseCase: CreateRoleRouteAccessUseCase) {}

  execute(input: GrantRoleRouteAccessInput, ctx: AiToolContext) {
    return this.createUseCase.execute(input, ctx.userId);
  }
}
