import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiToolDef } from 'src/domain/ai/ai-tool.decorator';
import type {
  IAiTool,
  AiToolDefinition,
  AiToolContext,
} from 'src/domain/ai/ai-tool.types';
import { StartTimerUseCase } from '../use-cases/start-timer.use-case';

const StartTimerInputSchema = z
  .object({
    description: z
      .string()
      .optional()
      .describe('Descrição ou título da atividade a ser trabalhada'),
    projectId: z
      .string()
      .uuid()
      .optional()
      .describe('ID do projeto opcional para vincular'),
    entityType: z
      .string()
      .optional()
      .describe('Tipo de entidade vinculada (ex: TASK, MILESTONE, PROJECT)'),
    entityId: z
      .string()
      .optional()
      .describe('ID da entidade vinculada'),
    entityTitle: z
      .string()
      .optional()
      .describe('Título ou nome da tarefa/entidade vinculada'),
    isBillable: z
      .boolean()
      .optional()
      .default(true)
      .describe('Se a atividade é faturável'),
  })
  .strict();

type StartTimerInput = z.infer<typeof StartTimerInputSchema>;

@AiToolDef()
@Injectable()
export class StartTimerTool implements IAiTool {
  readonly definition: AiToolDefinition = {
    name: 'start_timer',
    description:
      'Inicia ou troca o cronômetro de trabalho para o usuário logado (estilo Clockify). Se houver timer rodando, finaliza o anterior automaticamente.',
    inputSchema: StartTimerInputSchema,
    roles: ['ADMIN', 'MODERATOR'],
  };

  constructor(private readonly startTimer: StartTimerUseCase) {}

  execute(input: StartTimerInput, ctx: AiToolContext) {
    return this.startTimer.execute(ctx.userId, {
      ...input,
      isBillable: input.isBillable ?? true,
    });
  }
}
