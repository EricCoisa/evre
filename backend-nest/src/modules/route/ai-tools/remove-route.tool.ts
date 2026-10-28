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
import { RemoveRouteUseCase } from '../use-cases/remove.use-case';

const RemoveRouteSchema = z.object({ id: z.string().uuid() });
type RemoveRouteInput = z.infer<typeof RemoveRouteSchema>;

@AiToolDef()
@Injectable()
export class RemoveRouteTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'remove_route',
    description: 'Remove uma rota pelo id. Falha se a rota tiver rotas filhas.',
    inputSchema: RemoveRouteSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.ROUTES_WRITE,
    invalidates: [InvalidationTags.ROUTE],
  };

  constructor(private readonly removeUseCase: RemoveRouteUseCase) {}

  execute(input: RemoveRouteInput, ctx: AiToolContext) {
    return this.removeUseCase.execute(input.id, ctx.userId);
  }
}
