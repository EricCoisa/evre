import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindAllRoutesUseCase } from '../use-cases/find-all.use-case';
import {
  PaginationQuery,
  PaginationQuerySchema,
} from 'src/common/schemas/pagination.schema';

@AiToolDef()
@Injectable()
export class ListRoutesTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_routes',
    description: 'Lista todas as rotas do sistema com paginação.',
    inputSchema: PaginationQuerySchema,
    roles: ['ADMIN', 'USER'],
    invalidates: [],
  };

  constructor(private readonly findAllUseCase: FindAllRoutesUseCase) {}

  execute(input: PaginationQuery, _ctx: AiToolContext) {
    return this.findAllUseCase.execute(input);
  }
}
