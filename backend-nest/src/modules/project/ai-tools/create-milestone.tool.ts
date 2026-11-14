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
import { CreateMilestoneUseCase } from '../use-cases/create-milestone.use-case';
import { CreateMilestoneSchema } from '../dto/create-milestone.dto';

const CreateMilestoneInputSchema = z
  .object({ projectId: z.string().uuid() })
  .merge(CreateMilestoneSchema);
type CreateMilestoneInput = z.infer<typeof CreateMilestoneInputSchema>;

@AiToolDef()
@Injectable()
export class CreateMilestoneTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'create_milestone',
    description:
      'Cria uma milestone (coluna do board) em um projeto. Entra na última posição.',
    inputSchema: CreateMilestoneInputSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly createMilestone: CreateMilestoneUseCase) {}

  execute(input: CreateMilestoneInput, ctx: AiToolContext) {
    const { projectId, ...dto } = input;
    return this.createMilestone.execute(
      projectId,
      dto,
      toAuthenticatedUser(ctx),
    );
  }
}
