import { createZodDto } from 'nestjs-zod';
import { ActivityStatusConst } from 'src/domain/project/activityStatus.const';
import { z } from 'zod';

const UpdateActivitySchema = z
  .object({
    title: z.string().min(3).max(255).optional(),
    description: z.string().optional(),
    status: z
      .enum([
        ActivityStatusConst.TODO,
        ActivityStatusConst.DOING,
        ActivityStatusConst.DONE,
      ])
      .optional(),
  })
  .strict();

export class UpdateActivityDto extends createZodDto(UpdateActivitySchema) {}
