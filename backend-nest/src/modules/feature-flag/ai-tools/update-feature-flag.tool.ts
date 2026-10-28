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
import { UpdateFeatureFlagUseCase } from '../use-cases/update.use-case';
import { UpdateFeatureFlagSchema } from '../dto/update-feature-flag.dto';

const UpdateFeatureFlagToolSchema = z
  .object({ id: z.string().uuid() })
  .extend(UpdateFeatureFlagSchema.shape);
type UpdateFeatureFlagInput = z.infer<typeof UpdateFeatureFlagToolSchema>;

@AiToolDef()
@Injectable()
export class UpdateFeatureFlagTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_feature_flag',
    description:
      'Atualiza a descrição e/ou o enabled de uma feature flag pelo id. Para só ligar/desligar, prefira toggle_feature_flag.',
    inputSchema: UpdateFeatureFlagToolSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.FEATURE_FLAGS_WRITE,
    invalidates: [InvalidationTags.FEATURE_FLAGS],
  };

  constructor(private readonly update$: UpdateFeatureFlagUseCase) {}

  execute(input: UpdateFeatureFlagInput, _ctx: AiToolContext) {
    const { id, ...dto } = input;
    return this.update$.execute(id, dto);
  }
}
