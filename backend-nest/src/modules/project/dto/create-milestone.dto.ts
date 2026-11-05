import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateMilestoneSchema = z
  .object({
    title: z.string().min(1).describe('Milestone (column) title'),
  })
  .strict();

export class CreateMilestoneDto extends createZodDto(CreateMilestoneSchema) {}
