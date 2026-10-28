import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindByPathUseCase } from '../use-cases/find-by-path.use-case';

const GetRouteByPathSchema = z.object({ path: z.string().min(1) });
type GetRouteByPathInput = z.infer<typeof GetRouteByPathSchema>;

@AiToolDef()
@Injectable()
export class GetRouteByPathTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_route_by_path',
    description: 'Busca uma rota pelo caminho (ex: /dashboard/user).',
    inputSchema: GetRouteByPathSchema,
    invalidates: [],
  };

  constructor(private readonly findByPathUseCase: FindByPathUseCase) {}

  execute(input: GetRouteByPathInput, _ctx: AiToolContext) {
    return this.findByPathUseCase.execute(input.path);
  }
}
