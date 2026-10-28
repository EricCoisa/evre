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
import { DeleteInviteUseCase } from '../use-cases/delete-invite.use-case';

const DeleteInviteSchema = z.object({ id: z.string().uuid() });
type DeleteInviteInput = z.infer<typeof DeleteInviteSchema>;

@AiToolDef()
@Injectable()
export class DeleteInviteTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'delete_invite',
    description:
      'Remove um convite pendente pelo id. Use list_invites antes para obter o id.',
    inputSchema: DeleteInviteSchema,
    roles: ['ADMIN'],
    approvalScope: McpScopes.INVITES_WRITE,
    invalidates: [InvalidationTags.AUTH],
  };

  constructor(private readonly deleteInvite: DeleteInviteUseCase) {}

  execute(input: DeleteInviteInput, _ctx: AiToolContext) {
    return this.deleteInvite.execute(input.id);
  }
}
