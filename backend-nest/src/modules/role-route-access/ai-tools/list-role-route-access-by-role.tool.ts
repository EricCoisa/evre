import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindByRoleUseCase } from '../use-cases/find-by-role.use-case';
import { PaginationQuerySchema } from 'src/common/schemas/pagination.schema';

const ListByRoleSchema = z
  .object({ roleId: z.string().uuid() })
  .extend(PaginationQuerySchema.shape);
type ListByRoleInput = z.infer<typeof ListByRoleSchema>;

@AiToolDef()
@Injectable()
export class ListRoleRouteAccessByRoleTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_role_route_access_by_role',
    description:
      'Retorna todas as rotas do sistema marcando quais um role específico tem acesso.',
    inputSchema: ListByRoleSchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(private readonly findByRoleUseCase: FindByRoleUseCase) {}

  execute(input: ListByRoleInput, _ctx: AiToolContext) {
    const { roleId, ...query } = input;
    return this.findByRoleUseCase.execute(roleId, query);
  }
}
