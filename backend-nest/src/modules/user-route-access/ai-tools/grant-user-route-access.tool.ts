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
import { GrantAccessUseCase } from '../use-cases/grant-access.use-case';
import { GrantUserRouteAccessSchema } from '../dto/grant-user-route-access.dto';

type GrantUserRouteAccessInput = z.infer<typeof GrantUserRouteAccessSchema>;

@AiToolDef()
@Injectable()
export class GrantUserRouteAccessTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'grant_user_route_access',
    description:
      'Concede a um usuário específico acesso a uma rota do sistema.',
    inputSchema: GrantUserRouteAccessSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.USER_ROUTE_ACCESS_WRITE,
    invalidates: [InvalidationTags.USER_ROUTE_ACCESS],
  };

  constructor(private readonly grantAccessUseCase: GrantAccessUseCase) {}

  execute(input: GrantUserRouteAccessInput, ctx: AiToolContext) {
    return this.grantAccessUseCase.execute(input, ctx.userId);
  }
}
