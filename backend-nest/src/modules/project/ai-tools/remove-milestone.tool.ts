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
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { RemoveMilestoneUseCase } from '../use-cases/remove-milestone.use-case';

const RemoveMilestoneSchema = z
  .object({ projectId: z.string().uuid(), milestoneId: z.string().uuid() })
  .strict();
type RemoveMilestoneInput = z.infer<typeof RemoveMilestoneSchema>;

@AiToolDef()
@Injectable()
export class RemoveMilestoneTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'remove_milestone',
    description:
      'Remove uma milestone de um projeto, junto com suas tasks. Irreversível.',
    inputSchema: RemoveMilestoneSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly removeMilestone: RemoveMilestoneUseCase) {}

  execute(input: RemoveMilestoneInput, ctx: AiToolContext) {
    return this.removeMilestone.execute(
      input.projectId,
      input.milestoneId,
      toAuthenticatedUser(ctx),
    );
  }
}
