import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindOneFeatureFlagUseCase } from '../use-cases/find-one.use-case';

const GetFeatureFlagSchema = z.object({ id: z.string().uuid() });
type GetFeatureFlagInput = z.infer<typeof GetFeatureFlagSchema>;

@AiToolDef()
@Injectable()
export class GetFeatureFlagTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_feature_flag',
    description:
      'Busca uma feature flag específica pelo id. Use list_feature_flags antes para obter o id.',
    inputSchema: GetFeatureFlagSchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(private readonly findOne$: FindOneFeatureFlagUseCase) {}

  execute(input: GetFeatureFlagInput, _ctx: AiToolContext) {
    return this.findOne$.execute(input.id);
  }
}
