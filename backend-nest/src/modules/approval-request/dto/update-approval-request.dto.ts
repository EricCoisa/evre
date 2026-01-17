import { createZodDto } from 'nestjs-zod';
import { ApprovalRequestStatusEnum } from 'src/domain/approval-request/approval-requestStatus.const';
import { z } from 'zod';

export const UpdateApprovalRequestSchema = z
  .object({
    status: z
      .nativeEnum(ApprovalRequestStatusEnum)
      .optional()
      .describe('Approval request status'),
  })
  .strict();

export class UpdateApprovalRequestDto extends createZodDto(
  UpdateApprovalRequestSchema,
) {}
