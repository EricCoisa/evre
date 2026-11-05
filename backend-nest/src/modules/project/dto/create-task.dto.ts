import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateTaskSchema = z
  .object({
    title: z.string().min(1).describe('Task (card) title'),
    description: z.string().optional().describe('Task description'),
  })
  .strict();

export class CreateTaskDto extends createZodDto(CreateTaskSchema) {}
