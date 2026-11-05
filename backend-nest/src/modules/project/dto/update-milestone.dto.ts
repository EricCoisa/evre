import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateMilestoneSchema = z
  .object({
    title: z.string().min(1).optional().describe('Milestone title'),
  })
  .strict();

export class UpdateMilestoneDto extends createZodDto(UpdateMilestoneSchema) {}
