import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const MoveTaskSchema = z
  .object({
    milestoneId: z.string().uuid().describe('Target milestone'),
    position: z
      .number()
      .int()
      .min(0)
      .describe('Position within the target milestone'),
  })
  .strict();

export class MoveTaskDto extends createZodDto(MoveTaskSchema) {}
