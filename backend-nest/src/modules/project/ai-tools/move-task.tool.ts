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
import { MoveTaskUseCase } from '../use-cases/move-task.use-case';
import { MoveTaskSchema } from '../dto/move-task.dto';

const MoveTaskInputSchema = z
  .object({ projectId: z.string().uuid(), taskId: z.string().uuid() })
  .merge(MoveTaskSchema);
type MoveTaskInput = z.infer<typeof MoveTaskInputSchema>;

@AiToolDef()
@Injectable()
export class MoveTaskTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'move_task',
    description:
      'Move uma task para outra milestone (ou outra posição na mesma), estilo arrastar no board.',
    inputSchema: MoveTaskInputSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly moveTask: MoveTaskUseCase) {}

  execute(input: MoveTaskInput, ctx: AiToolContext) {
    const { projectId, taskId, ...dto } = input;
    return this.moveTask.execute(
      projectId,
      taskId,
      dto,
      toAuthenticatedUser(ctx),
    );
  }
}
