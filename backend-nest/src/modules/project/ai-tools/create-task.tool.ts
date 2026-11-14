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
import { CreateTaskUseCase } from '../use-cases/create-task.use-case';
import { CreateTaskSchema } from '../dto/create-task.dto';

const CreateTaskInputSchema = z
  .object({ projectId: z.string().uuid(), milestoneId: z.string().uuid() })
  .merge(CreateTaskSchema);
type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

@AiToolDef()
@Injectable()
export class CreateTaskTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'create_task',
    description:
      'Cria uma task (card) em uma milestone de um projeto. Sem assigneeId, a task fica atribuída a quem a criou. Entra na última posição da milestone.',
    inputSchema: CreateTaskInputSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly createTask: CreateTaskUseCase) {}

  execute(input: CreateTaskInput, ctx: AiToolContext) {
    const { projectId, milestoneId, ...dto } = input;
    return this.createTask.execute(
      projectId,
      milestoneId,
      dto,
      toAuthenticatedUser(ctx),
    );
  }
}
