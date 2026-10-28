import { Injectable } from '@nestjs/common';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindAllUsersUseCase } from '../use-cases/find-all-users.use-case';
import {
  PaginationQuery,
  PaginationQuerySchema,
} from 'src/common/schemas/pagination.schema';

@AiToolDef()
@Injectable()
export class ListUsersTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_users',
    description:
      'Lista os usuários do sistema com paginação e busca por nome/email.',
    inputSchema: PaginationQuerySchema,
    roles: ['ADMIN', 'MODERATOR'],
    invalidates: [],
  };

  constructor(private readonly findAllUsers: FindAllUsersUseCase) {}

  execute(input: PaginationQuery, _ctx: AiToolContext) {
    return this.findAllUsers.execute(input);
  }
}
