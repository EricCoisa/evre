import { createZodDto } from 'nestjs-zod';
import { ApprovalStatusConst } from 'src/domain/project/approvalStatus.const';
import { z } from 'zod';

const CreateApprovalSchema = z
  .object({
    approvalRequestId: z.string().uuid(),
    status: z.enum([
      ApprovalStatusConst.APPROVED,
      ApprovalStatusConst.APPROVED_WITH_REMARKS,
      ApprovalStatusConst.REJECTED,
    ]),
    comment: z.string().optional(),
  })
  .strict()
  .refine(
    (data) => {
      // Comentário obrigatório para REJECTED e APPROVED_WITH_REMARKS
      if (
        (data.status === ApprovalStatusConst.REJECTED || 
         data.status === ApprovalStatusConst.APPROVED_WITH_REMARKS) &&
        !data.comment?.trim()
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Comment is required for rejection or approval with remarks',
      path: ['comment'],
    },
  );

export class CreateApprovalDto extends createZodDto(CreateApprovalSchema) {}
