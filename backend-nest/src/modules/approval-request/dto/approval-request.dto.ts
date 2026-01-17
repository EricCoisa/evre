import { createZodDto } from 'nestjs-zod';
import { ApprovalRequestStatus } from 'src/domain/approval-request/approval-requestStatus.const';
import { z } from 'zod';

export const ApprovalRequestSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  stageId: z.string().uuid(),
  requestedById: z.string().uuid(),
  status: z.nativeEnum(ApprovalRequestStatus),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export class ApprovalRequestDto extends createZodDto(ApprovalRequestSchema) {}
