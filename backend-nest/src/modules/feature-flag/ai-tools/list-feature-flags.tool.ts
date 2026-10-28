import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FeatureFlagService } from '../feature-flag.service';

@AiToolDef()
@Injectable()
export class ListFeatureFlagsTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_feature_flags',
    description:
      'Lista todas as feature flags do sistema com status habilitado/desabilitado.',
    inputSchema: z.object({}),
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(private readonly featureFlagService: FeatureFlagService) {}

  execute(_input: unknown, _ctx: AiToolContext) {
    return this.featureFlagService.findAll();
  }
}
