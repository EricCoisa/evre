import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { toAuthenticatedUser } from 'src/domain/ai/ai-tool.types';
import { ListTimeEntriesUseCase } from '../use-cases/list-time-entries.use-case';
import { ListTimeEntriesSchema } from '../dto/list-time-entries.dto';
import type { ListTimeEntriesDto } from '../dto/list-time-entries.dto';

@AiToolDef()
@Injectable()
export class ListTimeEntriesTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_time_entries',
    description:
      'Lista o histórico de registros de tempo com filtros (projeto, entidade, período, busca) e paginação. MODERATOR só vê os próprios; ADMIN pode filtrar por userId.',
    inputSchema: ListTimeEntriesSchema,
    roles: ['ADMIN', 'MODERATOR'],
    invalidates: [],
  };

  constructor(private readonly listTimeEntries: ListTimeEntriesUseCase) {}

  execute(input: ListTimeEntriesDto, ctx: AiToolContext) {
    return this.listTimeEntries.execute(input, toAuthenticatedUser(ctx));
  }
}
