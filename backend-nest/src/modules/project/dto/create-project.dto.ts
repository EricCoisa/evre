import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateProjectSchema = z
  .object({
    companyId: z.string().uuid().describe('Company this project belongs to'),
    name: z.string().min(1).describe('Project name'),
    description: z.string().optional().describe('Project description'),
  })
  .strict();

export class CreateProjectDto extends createZodDto(CreateProjectSchema) {}
