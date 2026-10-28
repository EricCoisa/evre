import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindAllRoleRouteAccessUseCase } from '../use-cases/find-all.use-case';
import {
  PaginationQuery,
  PaginationQuerySchema,
} from 'src/common/schemas/pagination.schema';

@AiToolDef()
@Injectable()
export class ListRoleRouteAccessTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_role_route_access',
    description: 'Lista os acessos de rota concedidos a roles, com paginação.',
    inputSchema: PaginationQuerySchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(private readonly findAllUseCase: FindAllRoleRouteAccessUseCase) {}

  execute(input: PaginationQuery, _ctx: AiToolContext) {
    return this.findAllUseCase.execute(input);
  }
}
