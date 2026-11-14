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
import { ReorderTasksUseCase } from '../use-cases/reorder-tasks.use-case';
import { ReorderSchema } from '../dto/reorder.dto';

const ReorderTasksInputSchema = z
  .object({ projectId: z.string().uuid(), milestoneId: z.string().uuid() })
  .merge(ReorderSchema);
type ReorderTasksInput = z.infer<typeof ReorderTasksInputSchema>;

@AiToolDef()
@Injectable()
export class ReorderTasksTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'reorder_tasks',
    description:
      'Reordena as tasks dentro de uma milestone. orderedIds deve conter TODOS os ids de task da milestone, na nova ordem desejada.',
    inputSchema: ReorderTasksInputSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly reorderTasks: ReorderTasksUseCase) {}

  async execute(input: ReorderTasksInput, ctx: AiToolContext) {
    const { projectId, milestoneId, ...dto } = input;
    await this.reorderTasks.execute(
      projectId,
      milestoneId,
      dto,
      toAuthenticatedUser(ctx),
    );
    return { success: true };
  }
}
