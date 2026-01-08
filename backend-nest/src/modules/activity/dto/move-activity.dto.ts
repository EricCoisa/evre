import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MoveActivitySchema = z
  .object({
    activityId: z.string().uuid(),
    targetStageId: z.string().uuid(),
  })
  .strict();

export class MoveActivityDto extends createZodDto(MoveActivitySchema) {}
