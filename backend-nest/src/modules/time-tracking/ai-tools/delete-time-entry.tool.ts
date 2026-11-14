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
import { DeleteTimeEntryUseCase } from '../use-cases/delete-time-entry.use-case';

const DeleteTimeEntrySchema = z.object({ id: z.string().uuid() }).strict();
type DeleteTimeEntryInput = z.infer<typeof DeleteTimeEntrySchema>;

@AiToolDef()
@Injectable()
export class DeleteTimeEntryTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'delete_time_entry',
    description:
      'Exclui um registro de tempo (ou descarta o timer ativo) pelo id. MODERATOR só pode excluir os próprios registros; ADMIN exclui qualquer um. Irreversível.',
    inputSchema: DeleteTimeEntrySchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.TIME_TRACKING_WRITE,
    invalidates: [InvalidationTags.TIME_TRACKING],
  };

  constructor(private readonly deleteTimeEntry: DeleteTimeEntryUseCase) {}

  execute(input: DeleteTimeEntryInput, ctx: AiToolContext) {
    return this.deleteTimeEntry.execute(input.id, toAuthenticatedUser(ctx));
  }
}
