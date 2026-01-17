import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateApprovalRequestSchema = z
  .object({
    name: z.string().min(1).describe('Name of the approvalrequest'),
    description: z
      .string()
      .optional()
      .describe('Description of the approvalrequest'),
    isActive: z.boolean().optional().default(true).describe('Active status'),
  })
  .strict();

export class CreateApprovalRequestDto extends createZodDto(
  CreateApprovalRequestSchema,
) {}
