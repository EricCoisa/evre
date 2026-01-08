import { createZodDto } from 'nestjs-zod';
import { ApprovalStatusConst } from 'src/domain/project/approvalStatus.const';
import { z } from 'zod';

const CreateApprovalSchema = z
  .object({
    projectId: z.string().uuid(),
    entityType: z.enum(['STAGE']),
    entityId: z.string().uuid(),
    status: z.enum([
      ApprovalStatusConst.APPROVED,
      ApprovalStatusConst.REJECTED,
    ]),
    comment: z.string().optional(),
  })
  .strict();

export class CreateApprovalDto extends createZodDto(CreateApprovalSchema) {}
