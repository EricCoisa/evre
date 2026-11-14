import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { GetActiveTimerUseCase } from '../use-cases/get-active-timer.use-case';

const GetActiveTimerInputSchema = z.object({}).strict();

@AiToolDef()
@Injectable()
export class GetActiveTimerTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'get_active_timer',
    description:
      'Retorna o cronômetro ativo do usuário logado (se houver), com indicador de "esquecido" (rodando além do limiar configurado).',
    inputSchema: GetActiveTimerInputSchema,
    roles: ['ADMIN', 'MODERATOR'],
    invalidates: [],
  };

  constructor(private readonly getActiveTimer: GetActiveTimerUseCase) {}

  execute(_input: unknown, ctx: AiToolContext) {
    return this.getActiveTimer.execute(ctx.userId);
  }
}
