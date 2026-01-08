import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ReorderStagesSchema = z
  .object({
    stages: z.array(
      z.object({
        stageId: z.string().uuid(),
        order: z.number().int().min(0),
      }),
    ),
  })
  .strict();

export class ReorderStagesDto extends createZodDto(ReorderStagesSchema) {}
