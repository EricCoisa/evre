import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateProjectSchema = z
  .object({
    name: z.string().min(1).optional().describe('Project name'),
    description: z.string().optional().describe('Project description'),
    status: z
      .enum(['ACTIVE', 'COMPLETED', 'ARCHIVED'])
      .optional()
      .describe('Project status'),
  })
  .strict();

export class UpdateProjectDto extends createZodDto(UpdateProjectSchema) {}
