import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { CheckAccessUseCase } from '../use-cases/check-access.use-case';

const CheckMyRouteAccessSchema = z.object({ path: z.string().min(1) });
type CheckMyRouteAccessInput = z.infer<typeof CheckMyRouteAccessSchema>;

@AiToolDef()
@Injectable()
export class CheckMyRouteAccessTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'check_my_route_access',
    description:
      'Verifica se o usuário logado tem acesso a uma rota específica do sistema.',
    inputSchema: CheckMyRouteAccessSchema,
    invalidates: [],
  };

  constructor(private readonly checkAccessUseCase: CheckAccessUseCase) {}

  execute(input: CheckMyRouteAccessInput, ctx: AiToolContext) {
    const normalizedPath = input.path.startsWith('/')
      ? input.path
      : `/${input.path}`;
    return this.checkAccessUseCase.execute(ctx.userId, normalizedPath);
  }
}
