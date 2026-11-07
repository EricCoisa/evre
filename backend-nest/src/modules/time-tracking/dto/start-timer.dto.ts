import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const StartTimerSchema = z
  .object({
    description: z
      .string()
      .nullable()
      .optional()
      .describe('Descrição ou título da atividade'),
    isBillable: z
      .boolean()
      .nullable()
      .optional()
      .default(true)
      .describe('Se a atividade é faturável'),
    entityType: z
      .string()
      .nullable()
      .optional()
      .describe('Tipo da entidade vinculada (ex: TASK, MILESTONE, PROJECT)'),
    entityId: z
      .string()
      .nullable()
      .optional()
      .describe('ID da entidade vinculada'),
    entityTitle: z
      .string()
      .nullable()
      .optional()
      .describe('Snapshot do título ou nome da entidade vinculada'),
    projectId: z
      .string()
      .nullable()
      .optional()
      .describe('ID do projeto para agrupamento'),
  })
  .strip();

export class StartTimerDto extends createZodDto(StartTimerSchema) {}
