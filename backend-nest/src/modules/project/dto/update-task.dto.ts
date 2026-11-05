import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateTaskSchema = z
  .object({
    title: z.string().min(1).optional().describe('Task title'),
    description: z.string().optional().describe('Task description'),
  })
  .strict();

export class UpdateTaskDto extends createZodDto(UpdateTaskSchema) {}
