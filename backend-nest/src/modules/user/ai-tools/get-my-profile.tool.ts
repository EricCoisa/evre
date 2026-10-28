import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { FindOneUserUseCase } from '../use-cases/find-one-user.use-case';

@AiToolDef()
@Injectable()
export class GetMyProfileTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_my_profile',
    description: 'Retorna os dados de perfil do usuário logado.',
    inputSchema: z.object({}),
    invalidates: [],
  };

  constructor(private readonly findOneUser: FindOneUserUseCase) {}

  execute(_input: unknown, ctx: AiToolContext) {
    return this.findOneUser.execute(ctx.userId);
  }
}
