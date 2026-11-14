import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { ListCommentsUseCase } from '../use-cases/list-comments.use-case';

const ListProjectCommentsSchema = z
  .object({
    projectId: z.string().uuid(),
    entityType: z.enum(['PROJECT', 'MILESTONE', 'TASK']),
    entityId: z.string().uuid(),
  })
  .strict();
type ListProjectCommentsInput = z.infer<typeof ListProjectCommentsSchema>;

@AiToolDef()
@Injectable()
export class ListProjectCommentsTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_project_comments',
    description:
      'Lista os comentários de um projeto, milestone ou task (entityType + entityId indicam o alvo).',
    inputSchema: ListProjectCommentsSchema,
    invalidates: [],
  };

  constructor(private readonly listComments: ListCommentsUseCase) {}

  execute(input: ListProjectCommentsInput, ctx: AiToolContext) {
    return this.listComments.execute(
      input.projectId,
      input.entityType,
      input.entityId,
      toAuthenticatedUser(ctx),
    );
  }
}
