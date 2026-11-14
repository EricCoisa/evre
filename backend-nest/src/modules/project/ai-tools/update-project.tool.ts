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
import { UpdateProjectUseCase } from '../use-cases/update.use-case';
import { UpdateProjectSchema } from '../dto/update-project.dto';

const UpdateProjectInputSchema = z
  .object({ id: z.string().uuid() })
  .merge(UpdateProjectSchema);
type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;

@AiToolDef()
@Injectable()
export class UpdateProjectTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_project',
    description:
      'Atualiza nome, descrição ou status de um projeto. status: ARCHIVED arquiva o projeto (equivalente a remove_project).',
    inputSchema: UpdateProjectInputSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly updateProject: UpdateProjectUseCase) {}

  execute(input: UpdateProjectInput, ctx: AiToolContext) {
    const { id, ...dto } = input;
    return this.updateProject.execute(id, dto, toAuthenticatedUser(ctx));
  }
}
