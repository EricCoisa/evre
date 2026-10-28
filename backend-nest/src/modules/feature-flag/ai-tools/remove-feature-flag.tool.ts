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
import { RemoveFeatureFlagUseCase } from '../use-cases/remove.use-case';

const RemoveFeatureFlagSchema = z.object({ id: z.string().uuid() });
type RemoveFeatureFlagInput = z.infer<typeof RemoveFeatureFlagSchema>;

@AiToolDef()
@Injectable()
export class RemoveFeatureFlagTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'remove_feature_flag',
    description:
      'Remove permanentemente uma feature flag pelo id. Use list_feature_flags antes para obter o id.',
    inputSchema: RemoveFeatureFlagSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.FEATURE_FLAGS_WRITE,
    invalidates: [InvalidationTags.FEATURE_FLAGS],
  };

  constructor(private readonly remove$: RemoveFeatureFlagUseCase) {}

  execute(input: RemoveFeatureFlagInput, _ctx: AiToolContext) {
    return this.remove$.execute(input.id);
  }
}
