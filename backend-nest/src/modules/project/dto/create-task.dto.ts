import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateTaskSchema = z
  .object({
    title: z.string().min(1).describe('Task (card) title'),
    description: z.string().optional().describe('Task rich text description'),
    status: z
      .enum(['WAITING', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'])
      .optional()
      .default('WAITING')
      .describe('Task status'),
    blockedReason: z
      .string()
      .optional()
      .describe('Reason why the task is blocked'),
  })
  .strict();

export class CreateTaskDto extends createZodDto(CreateTaskSchema) {}
