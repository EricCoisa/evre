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
import { RemoveTaskUseCase } from '../use-cases/remove-task.use-case';

const RemoveTaskSchema = z
  .object({ projectId: z.string().uuid(), taskId: z.string().uuid() })
  .strict();
type RemoveTaskInput = z.infer<typeof RemoveTaskSchema>;

@AiToolDef()
@Injectable()
export class RemoveTaskTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'remove_task',
    description: 'Remove uma task de um projeto. Irreversível.',
    inputSchema: RemoveTaskSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly removeTask: RemoveTaskUseCase) {}

  execute(input: RemoveTaskInput, ctx: AiToolContext) {
    return this.removeTask.execute(
      input.projectId,
      input.taskId,
      toAuthenticatedUser(ctx),
    );
  }
}
