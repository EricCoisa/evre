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
import { ReorderMilestonesUseCase } from '../use-cases/reorder-milestones.use-case';
import { ReorderSchema } from '../dto/reorder.dto';

const ReorderMilestonesInputSchema = z
  .object({ projectId: z.string().uuid() })
  .merge(ReorderSchema);
type ReorderMilestonesInput = z.infer<typeof ReorderMilestonesInputSchema>;

@AiToolDef()
@Injectable()
export class ReorderMilestonesTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'reorder_milestones',
    description:
      'Reordena as milestones de um projeto. orderedIds deve conter TODOS os ids de milestone do projeto, na nova ordem desejada.',
    inputSchema: ReorderMilestonesInputSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(
    private readonly reorderMilestones: ReorderMilestonesUseCase,
  ) {}

  async execute(input: ReorderMilestonesInput, ctx: AiToolContext) {
    const { projectId, ...dto } = input;
    await this.reorderMilestones.execute(
      projectId,
      dto,
      toAuthenticatedUser(ctx),
    );
    return { success: true };
  }
}
