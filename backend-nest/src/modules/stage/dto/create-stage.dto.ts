import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { StageStatusConst } from 'src/domain/project/stageStatus.const';

const CreateStageSchema = z
  .object({
    projectId: z.string().uuid(),
    name: z.string().min(3).max(255),
    order: z.number().int().min(0),
    status: z
      .enum([
        StageStatusConst.TODO,
        StageStatusConst.DOING,
        StageStatusConst.DONE,
      ])
      .optional(),
  })
  .strict();

export class CreateStageDto extends createZodDto(CreateStageSchema) {}
