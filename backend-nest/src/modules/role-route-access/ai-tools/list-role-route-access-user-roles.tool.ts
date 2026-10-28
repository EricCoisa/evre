import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindAllUserRoleUseCase } from '../use-cases/find-all-user-role.use-case';
import {
  PaginationQuery,
  PaginationQuerySchema,
} from 'src/common/schemas/pagination.schema';

@AiToolDef()
@Injectable()
export class ListRoleRouteAccessUserRolesTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_role_route_access_user_roles',
    description:
      'Lista os roles existentes no sistema, para uso ao gerenciar acesso de rotas por role.',
    inputSchema: PaginationQuerySchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(
    private readonly findAllUserRoleUseCase: FindAllUserRoleUseCase,
  ) {}

  execute(input: PaginationQuery, _ctx: AiToolContext) {
    return this.findAllUserRoleUseCase.execute(input);
  }
}
