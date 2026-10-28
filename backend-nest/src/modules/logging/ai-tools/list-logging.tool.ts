import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindAllLogsUseCase } from '../use-cases/find-all.use-case';
import {
  PaginationQuerySchema,
  PaginationQuery,
} from 'src/common/schemas/pagination.schema';

@AiToolDef()
@Injectable()
export class ListLoggingTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_logs',
    description: 'Lista de logs do sistema.',
    inputSchema: PaginationQuerySchema,
    roles: ['ADMIN', 'MODERATOR'],
    invalidates: [],
  };

  constructor(private readonly findAllUseCase: FindAllLogsUseCase) {}

  execute(input: PaginationQuery, _ctx: AiToolContext) {
    return this.findAllUseCase.execute(input);
  }
}
