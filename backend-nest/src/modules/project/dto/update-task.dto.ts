import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateTaskSchema = z
  .object({
    title: z.string().min(1).optional().describe('Task title'),
    description: z.string().optional().describe('Task rich text description'),
    status: z
      .enum(['WAITING', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'])
      .optional()
      .describe('Task status'),
    blockedReason: z
      .string()
      .nullable()
      .optional()
      .describe('Reason why the task is blocked'),
  })
  .strict();

export class UpdateTaskDto extends createZodDto(UpdateTaskSchema) {}
