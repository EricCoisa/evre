import { createZodDto } from 'nestjs-zod';
import { ProjectStatusConst } from 'src/domain/project/projectStatus.const';
import { z } from 'zod';

const CreateProjectSchema = z
  .object({
    companyId: z.string().uuid(),
    name: z.string().min(3).max(255),
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

export class CreateProjectDto extends createZodDto(CreateProjectSchema) {}
