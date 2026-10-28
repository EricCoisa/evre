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
import { SetFeatureFlagRolesUseCase } from '../use-cases/set-roles.use-case';
import { SetFeatureFlagRolesSchema } from '../dto/set-feature-flag-roles.dto';

const SetFeatureFlagRolesToolSchema = z
  .object({ id: z.string().uuid() })
  .extend(SetFeatureFlagRolesSchema.shape);
type SetFeatureFlagRolesInput = z.infer<typeof SetFeatureFlagRolesToolSchema>;

@AiToolDef()
@Injectable()
export class SetFeatureFlagRolesTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'set_feature_flag_roles',
    description:
      'Define quais roles têm acesso a uma feature flag (allowlist). Lista vazia libera para todas as roles.',
    inputSchema: SetFeatureFlagRolesToolSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.FEATURE_FLAGS_WRITE,
    invalidates: [InvalidationTags.FEATURE_FLAGS],
  };

  constructor(private readonly setRoles$: SetFeatureFlagRolesUseCase) {}

  execute(input: SetFeatureFlagRolesInput, _ctx: AiToolContext) {
    return this.setRoles$.execute(input.id, input.roleIds);
  }
}
