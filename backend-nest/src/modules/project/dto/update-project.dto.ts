import { createZodDto } from 'nestjs-zod';
import { ProjectStatusConst } from 'src/domain/project/projectStatus.const';
import { z } from 'zod';

const UpdateProjectSchema = z
  .object({
    proposalId: z.string().uuid().optional(),
    name: z.string().min(3).max(255).optional(),
    description: z.string().optional(),
    status: z
      .enum([
        ProjectStatusConst.PROPOSAL,
        ProjectStatusConst.REQUIREMENTS,
        ProjectStatusConst.DEVELOPMENT,
        ProjectStatusConst.DONE,
      ])
      .optional(),
  })
  .strict();

export class UpdateProjectDto extends createZodDto(UpdateProjectSchema) {}
