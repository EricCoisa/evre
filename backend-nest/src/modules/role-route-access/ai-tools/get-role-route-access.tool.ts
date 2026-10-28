import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindOneRoleRouteAccessUseCase } from '../use-cases/find-one.use-case';

const GetRoleRouteAccessSchema = z.object({
  roleId: z.string().uuid(),
  routeId: z.string().uuid(),
});
type GetRoleRouteAccessInput = z.infer<typeof GetRoleRouteAccessSchema>;

@AiToolDef()
@Injectable()
export class GetRoleRouteAccessTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_role_route_access',
    description:
      'Busca um acesso de rota específico de um role pelo par roleId/routeId.',
    inputSchema: GetRoleRouteAccessSchema,
    roles: ['ADMIN'],
    invalidates: [],
  };

  constructor(private readonly findOneUseCase: FindOneRoleRouteAccessUseCase) {}

  execute(input: GetRoleRouteAccessInput, _ctx: AiToolContext) {
    return this.findOneUseCase.execute(input.roleId, input.routeId);
  }
}
