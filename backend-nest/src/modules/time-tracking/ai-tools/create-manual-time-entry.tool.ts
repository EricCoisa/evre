import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';
import { InvalidationTags } from 'src/domain/ai/invalidation-tags.const';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { CreateManualEntryUseCase } from '../use-cases/create-manual-entry.use-case';
import { CreateManualEntrySchema } from '../dto/create-manual-entry.dto';
import type { CreateManualEntryDto } from '../dto/create-manual-entry.dto';

@AiToolDef()
@Injectable()
export class CreateManualTimeEntryTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'create_manual_time_entry',
    description:
      'Cria um registro retroativo (manual) de tempo trabalhado, com início e fim já definidos — não inicia um cronômetro.',
    inputSchema: CreateManualEntrySchema,
    roles: ['ADMIN', 'MODERATOR'],
    approvalScope: McpScopes.TIME_TRACKING_WRITE,
    invalidates: [InvalidationTags.TIME_TRACKING],
  };

  constructor(private readonly createManualEntry: CreateManualEntryUseCase) {}

  execute(input: CreateManualEntryDto, ctx: AiToolContext) {
    return this.createManualEntry.execute(ctx.userId, input);
  }
}
