import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateMilestoneSchema = z
  .object({
    title: z.string().min(1).optional().describe('Milestone title'),
    description: z
      .string()
      .optional()
      .describe('Milestone rich text description'),
  })
  .strict();

export class UpdateMilestoneDto extends createZodDto(UpdateMilestoneSchema) {}
