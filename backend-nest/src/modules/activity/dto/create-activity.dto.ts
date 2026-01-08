import { createZodDto } from 'nestjs-zod';
import { ActivityStatusConst } from 'src/domain/project/activityStatus.const';
import { z } from 'zod';

const CreateActivitySchema = z
  .object({
    stageId: z.string().uuid(),
    title: z.string().min(3).max(255),
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

export class CreateActivityDto extends createZodDto(CreateActivitySchema) {}
