import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindAllByOneUseCase } from '../use-cases/find-all-by-one.use-case';
import { PaginationQuerySchema } from 'src/common/schemas/pagination.schema';

const ListByUserSchema = z
  .object({ userId: z.string().uuid() })
  .extend(PaginationQuerySchema.shape);
type ListByUserInput = z.infer<typeof ListByUserSchema>;

@AiToolDef()
@Injectable()
export class ListUserRouteAccessByUserTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'list_user_route_access_by_user',
    description: 'Lista os acessos de rota concedidos a um usuário específico.',
    inputSchema: ListByUserSchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(private readonly findAllByOneUseCase: FindAllByOneUseCase) {}

  execute(input: ListByUserInput, _ctx: AiToolContext) {
    const { userId, ...query } = input;
    return this.findAllByOneUseCase.execute(userId, query);
  }
}
