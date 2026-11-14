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
import { UpdateTimeEntryUseCase } from '../use-cases/update-time-entry.use-case';
import { UpdateTimeEntrySchema } from '../dto/update-time-entry.dto';

const UpdateTimeEntryInputSchema = z
  .object({ id: z.string().uuid() })
  .merge(UpdateTimeEntrySchema);
type UpdateTimeEntryInput = z.infer<typeof UpdateTimeEntryInputSchema>;

@AiToolDef()
@Injectable()
export class UpdateTimeEntryTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'update_time_entry',
    description:
      'Edita um registro de tempo existente (marca como editado manualmente). MODERATOR só pode editar os próprios registros; ADMIN edita qualquer um.',
    inputSchema: UpdateTimeEntryInputSchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.TIME_TRACKING_WRITE,
    invalidates: [InvalidationTags.TIME_TRACKING],
  };

  constructor(private readonly updateTimeEntry: UpdateTimeEntryUseCase) {}

  execute(input: UpdateTimeEntryInput, ctx: AiToolContext) {
    const { id, ...dto } = input;
    return this.updateTimeEntry.execute(id, dto, toAuthenticatedUser(ctx));
  }
}
