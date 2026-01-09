import { createZodDto } from 'nestjs-zod';
import { StageStatusConst } from 'src/domain/project/stageStatus.const';
import { z } from 'zod';

const UpdateStageSchema = z
  .object({
    name: z.string().min(3).max(255).optional(),
    order: z.number().int().min(0).optional(),
    status: z.nativeEnum(StageStatusConst).optional(),
  })
  .strict();

export class UpdateStageDto extends createZodDto(UpdateStageSchema) {}
