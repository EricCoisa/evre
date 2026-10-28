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
import { CreateFeatureFlagUseCase } from '../use-cases/create.use-case';
import { CreateFeatureFlagSchema } from '../dto/create-feature-flag.dto';

type CreateFeatureFlagInput = z.infer<typeof CreateFeatureFlagSchema>;

@AiToolDef()
@Injectable()
export class CreateFeatureFlagTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'create_feature_flag',
    description: 'Cria uma nova feature flag.',
    inputSchema: CreateFeatureFlagSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.FEATURE_FLAGS_WRITE,
    invalidates: [InvalidationTags.FEATURE_FLAGS],
  };

  constructor(private readonly create$: CreateFeatureFlagUseCase) {}

  execute(input: CreateFeatureFlagInput, _ctx: AiToolContext) {
    return this.create$.execute(input);
  }
}
