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
import { DeleteRoleUseCase } from '../use-cases/delete.use-case';

const DeleteRoleSchema = z.object({ id: z.string().uuid() });
type DeleteRoleInput = z.infer<typeof DeleteRoleSchema>;

@AiToolDef()
@Injectable()
export class DeleteRoleTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'delete_role',
    description:
      'Remove um role pelo id. Roles de sistema não podem ser removidos.',
    inputSchema: DeleteRoleSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.ROLES_WRITE,
    invalidates: [InvalidationTags.ROLE],
  };

  constructor(private readonly deleteRole: DeleteRoleUseCase) {}

  execute(input: DeleteRoleInput, _ctx: AiToolContext) {
    return this.deleteRole.execute(input.id);
  }
}
