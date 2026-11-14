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
import { CreateCommentUseCase } from '../use-cases/create-comment.use-case';

const CreateProjectCommentSchema = z
  .object({
    projectId: z.string().uuid(),
    entityType: z.enum(['PROJECT', 'MILESTONE', 'TASK']),
    entityId: z.string().uuid(),
    content: z.string().min(1).max(5000),
  })
  .strict();
type CreateProjectCommentInput = z.infer<typeof CreateProjectCommentSchema>;

@AiToolDef()
@Injectable()
export class CreateProjectCommentTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'create_project_comment',
    description:
      'Adiciona um comentário a um projeto, milestone ou task (entityType + entityId indicam o alvo).',
    inputSchema: CreateProjectCommentSchema,
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly createComment: CreateCommentUseCase) {}

  execute(input: CreateProjectCommentInput, ctx: AiToolContext) {
    const { projectId, ...dto } = input;
    return this.createComment.execute(
      projectId,
      dto,
      toAuthenticatedUser(ctx),
    );
  }
}
