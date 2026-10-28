import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindOneRouteUseCase } from '../use-cases/find-one.use-case';

const GetRouteSchema = z.object({ id: z.string().uuid() });
type GetRouteInput = z.infer<typeof GetRouteSchema>;

@AiToolDef()
@Injectable()
export class GetRouteTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_route',
    description: 'Busca uma rota específica pelo id.',
    inputSchema: GetRouteSchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(private readonly findOneUseCase: FindOneRouteUseCase) {}

  execute(input: GetRouteInput, _ctx: AiToolContext) {
    return this.findOneUseCase.execute(input.id);
  }
}
