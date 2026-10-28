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
export class FindUserTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'find_user',
    description: 'Busca um usuário específico pelo ID.',
    inputSchema: z.object({
      id: z.string().uuid(),
    }),
    roles: ['ADMIN', 'MODERATOR'],
    invalidates: [],
  };

  constructor(private readonly findOneUser: FindOneUserUseCase) {}

  execute(input: { id: string }, _ctx: AiToolContext) {
    return this.findOneUser.execute(input.id);
  }
}
