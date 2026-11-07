import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateTimeEntrySchema = z
  .object({
    description: z
      .string()
      .nullable()
      .optional()
      .describe('Descrição ou título da atividade'),
    startTime: z
      .string()
      .datetime()
      .optional()
      .describe('Data e hora de início (ISO 8601)'),
    endTime: z
      .string()
      .datetime()
      .nullable()
      .optional()
      .describe('Data e hora de término (ISO 8601)'),
    isBillable: z
      .boolean()
      .nullable()
      .optional()
      .describe('Se a atividade é faturável'),
    entityType: z
      .string()
      .nullable()
      .optional()
      .describe('Tipo da entidade vinculada'),
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

export class UpdateTimeEntryDto extends createZodDto(UpdateTimeEntrySchema) {}
