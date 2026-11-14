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
import { DeleteCommentUseCase } from '../use-cases/delete-comment.use-case';

const RemoveProjectCommentSchema = z
  .object({ projectId: z.string().uuid(), commentId: z.string().uuid() })
  .strict();
type RemoveProjectCommentInput = z.infer<typeof RemoveProjectCommentSchema>;

@AiToolDef()
@Injectable()
export class RemoveProjectCommentTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'remove_project_comment',
    description:
      'Remove um comentário de um projeto. Só o autor do comentário ou um ADMIN pode remover.',
    inputSchema: RemoveProjectCommentSchema,
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly deleteComment: DeleteCommentUseCase) {}

  async execute(input: RemoveProjectCommentInput, ctx: AiToolContext) {
    await this.deleteComment.execute(
      input.projectId,
      input.commentId,
      toAuthenticatedUser(ctx),
    );
    return { success: true };
  }
}
