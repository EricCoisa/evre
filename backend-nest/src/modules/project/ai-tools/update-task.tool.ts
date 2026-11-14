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
import { UpdateTaskUseCase } from '../use-cases/update-task.use-case';
import { UpdateTaskSchema } from '../dto/update-task.dto';

const UpdateTaskInputSchema = z
  .object({ projectId: z.string().uuid(), taskId: z.string().uuid() })
  .merge(UpdateTaskSchema);
type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

@AiToolDef()
@Injectable()
export class UpdateTaskTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_task',
    description:
      'Atualiza título, descrição, status, motivo de bloqueio ou responsável de uma task. Para mover entre milestones, use move_task.',
    inputSchema: UpdateTaskInputSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly updateTask: UpdateTaskUseCase) {}

  execute(input: UpdateTaskInput, ctx: AiToolContext) {
    const { projectId, taskId, ...dto } = input;
    return this.updateTask.execute(
      projectId,
      taskId,
      dto,
      toAuthenticatedUser(ctx),
    );
  }
}
