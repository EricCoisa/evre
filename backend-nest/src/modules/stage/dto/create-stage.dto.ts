import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateStageSchema = z
  .object({
    projectId: z.string().uuid(),
    name: z.string().min(3).max(255),
    order: z.number().int().min(0),
    status: z.string().optional(),
  })
  .strict();

export class CreateStageDto extends createZodDto(CreateStageSchema) {}
