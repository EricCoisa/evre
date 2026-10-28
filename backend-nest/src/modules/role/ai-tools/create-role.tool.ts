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
import { CreateRoleUseCase } from '../use-cases/create.use-case';

const CreateRoleSchema = z.object({ name: z.string().min(1) });
type CreateRoleInput = z.infer<typeof CreateRoleSchema>;

@AiToolDef()
@Injectable()
export class CreateRoleTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'create_role',
    description: 'Cria um novo role global no sistema.',
    inputSchema: CreateRoleSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.ROLES_WRITE,
    invalidates: [InvalidationTags.ROLE],
  };

  constructor(private readonly createRole: CreateRoleUseCase) {}

  execute(input: CreateRoleInput, _ctx: AiToolContext) {
    return this.createRole.execute(input.name);
  }
}
