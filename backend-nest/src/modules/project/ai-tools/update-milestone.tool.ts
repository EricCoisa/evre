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
import { UpdateMilestoneUseCase } from '../use-cases/update-milestone.use-case';
import { UpdateMilestoneSchema } from '../dto/update-milestone.dto';

const UpdateMilestoneInputSchema = z
  .object({ projectId: z.string().uuid(), milestoneId: z.string().uuid() })
  .merge(UpdateMilestoneSchema);
type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneInputSchema>;

@AiToolDef()
@Injectable()
export class UpdateMilestoneTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_milestone',
    description: 'Atualiza título ou descrição de uma milestone.',
    inputSchema: UpdateMilestoneInputSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly updateMilestone: UpdateMilestoneUseCase) {}

  execute(input: UpdateMilestoneInput, ctx: AiToolContext) {
    const { projectId, milestoneId, ...dto } = input;
    return this.updateMilestone.execute(
      projectId,
      milestoneId,
      dto,
      toAuthenticatedUser(ctx),
    );
  }
}
