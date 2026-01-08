import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateStageSchema = z
  .object({
    name: z.string().min(3).max(255).optional(),
    order: z.number().int().min(0).optional(),
    status: z.string().optional(),
  })
  .strict();

export class UpdateStageDto extends createZodDto(UpdateStageSchema) {}
