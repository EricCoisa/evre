import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateApprovalRequestSchema = z
  .object({
    name: z.string().min(1).optional().describe('Name of the approvalrequest'),
    description: z
      .string()
      .optional()
      .describe('Description of the approvalrequest'),
    isActive: z.boolean().optional().describe('Active status'),
  })
  .strict();

export class UpdateApprovalRequestDto extends createZodDto(
  UpdateApprovalRequestSchema,
) {}
