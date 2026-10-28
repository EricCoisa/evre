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
import { UpdateRouteUseCase } from '../use-cases/update.use-case';
import { UpdateRouteSchema } from '../dto/update-route.dto';

const UpdateRouteToolSchema = z
  .object({ id: z.string().uuid() })
  .extend(UpdateRouteSchema.shape);
type UpdateRouteInput = z.infer<typeof UpdateRouteToolSchema>;

@AiToolDef()
@Injectable()
export class UpdateRouteTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_route',
    description: 'Atualiza os campos de uma rota existente pelo id.',
    inputSchema: UpdateRouteToolSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.ROUTES_WRITE,
    invalidates: [InvalidationTags.ROUTE],
  };

  constructor(private readonly updateUseCase: UpdateRouteUseCase) {}

  execute(input: UpdateRouteInput, ctx: AiToolContext) {
    const { id, ...dto } = input;
    return this.updateUseCase.execute(id, dto, ctx.userId);
  }
}
