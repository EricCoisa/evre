import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { CreateProjectUseCase } from '../use-cases/create.use-case';
import { CreateProjectSchema } from '../dto/create-project.dto';
import type { CreateProjectDto } from '../dto/create-project.dto';

@AiToolDef()
@Injectable()
export class CreateProjectTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'create_project',
    description: 'Cria um projeto vinculado a uma empresa.',
    inputSchema: CreateProjectSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.PROJECT_WRITE,
    invalidates: [InvalidationTags.PROJECT],
  };

  constructor(private readonly createProject: CreateProjectUseCase) {}

  execute(input: CreateProjectDto, ctx: AiToolContext) {
    return this.createProject.execute(input, ctx.userId);
  }
}
