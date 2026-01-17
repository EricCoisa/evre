import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateApprovalRequestSchema = z
  .object({
    projectId: z.string().uuid().describe('Project ID'),
    stageId: z.string().uuid().describe('Stage ID'),
  })
  .strict();

export class CreateApprovalRequestDto extends createZodDto(
  CreateApprovalRequestSchema,
) {}
