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

@AiToolDef()
@Injectable()
export class ToggleFeatureFlagTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'toggle_feature_flag',
    description:
      'Habilita ou desabilita uma feature flag pelo id. Use list_feature_flags antes para obter o id.',
    inputSchema: z.object({ id: z.string().uuid(), enabled: z.boolean() }),
    roles: ['ADMIN'],
    approvalScope: McpScopes.FEATURE_FLAGS_WRITE,
    invalidates: [InvalidationTags.FEATURE_FLAGS],
  };

  constructor(private readonly update$: UpdateFeatureFlagUseCase) {}

  async execute(input: unknown, _ctx: AiToolContext) {
    const { id, enabled } = input as { id: string; enabled: boolean };
    return this.update$.execute(id, { enabled });
  }
}
