import { createZodDto } from 'nestjs-zod';
import { StageStatusConst } from 'src/domain/project/stageStatus.const';
import { z } from 'zod';

const UpdateStageStatusSchema = z
  .object({
    status: z.nativeEnum(StageStatusConst),
  })
  .strict();

export class UpdateStageStatusDto extends createZodDto(
  UpdateStageStatusSchema,
) {}
