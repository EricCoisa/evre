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
import { CreateRouteUseCase } from '../use-cases/create.use-case';
import { CreateRouteSchema } from '../dto/create-route.dto';

type CreateRouteInput = z.infer<typeof CreateRouteSchema>;

@AiToolDef()
@Injectable()
export class CreateRouteTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'create_route',
    description: 'Cria uma nova rota do sistema (para menu/sidebar).',
    inputSchema: CreateRouteSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.ROUTES_WRITE,
    invalidates: [InvalidationTags.ROUTE],
  };

  constructor(private readonly createUseCase: CreateRouteUseCase) {}

  execute(input: CreateRouteInput, ctx: AiToolContext) {
    return this.createUseCase.execute(input, ctx.userId);
  }
}
