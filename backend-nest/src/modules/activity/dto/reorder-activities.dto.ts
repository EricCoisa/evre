import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ReorderActivitiesSchema = z.object({
  activities: z.array(
    z.object({
      activityId: z.string().uuid(),
      order: z.number().int().min(0),
    }),
  ),
});

export class ReorderActivitiesDto extends createZodDto(
  ReorderActivitiesSchema,
) {}
